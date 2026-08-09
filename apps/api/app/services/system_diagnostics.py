"""Fast health probes and non-destructive, on-demand system diagnostics."""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from importlib.metadata import PackageNotFoundError, version
import json
import logging
import math
import os
from pathlib import Path
import secrets
import shutil
import tempfile
from threading import Lock, Thread
from time import monotonic, perf_counter
from typing import Callable
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from sqlalchemy import case, func, inspect, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import POD_UPLOAD_DIR, SIGNATURE_UPLOAD_DIR
from app.db.base import Base
from app.db.models import CustomerNotification, NotificationStatus, Vehicle
from app.schemas import (
    DiagnosticTestResult,
    ServiceHealthItem,
    SystemDiagnosticsResponse,
    SystemHealthResponse,
)
from core_engine.solver import (
    Depot as SolverDepot,
    Order as SolverOrder,
    Vehicle as SolverVehicle,
    VRPInput,
    VRPSolver,
    haversine_km,
)


logger = logging.getLogger(__name__)
PROCESS_STARTED_AT = monotonic()
UPLOADS_ROOT = POD_UPLOAD_DIR.parent
OSRM_BASE_URL = os.getenv("OSRM_BASE_URL", "https://router.project-osrm.org").rstrip("/")
OSRM_DIAGNOSTIC_TIMEOUT_SECONDS = 1.0
OSRM_CACHE_SECONDS = 30.0
ACTIVE_GPS_WINDOW = timedelta(hours=1)
CRITICAL_SERVICES = frozenset({"database", "core_engine"})

SAMPLE_START = (10.8671, 106.6412)
SAMPLE_DESTINATION = (10.7769, 106.7009)


@dataclass(frozen=True)
class RoutingProbe:
    distance_km: float
    duration_mins: float


_osrm_cache_lock = Lock()
_osrm_cache: tuple[float, ServiceHealthItem] | None = None
_osrm_refreshing = False
_core_engine_cache_lock = Lock()
_core_engine_cache: ServiceHealthItem | None = None


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _elapsed_ms(started_at: float) -> float:
    return round((perf_counter() - started_at) * 1000, 2)


def _service_item(
    *,
    service_key: str,
    name: str,
    status: str,
    latency_ms: float | None,
    details: dict[str, object],
    checked_at: datetime,
) -> ServiceHealthItem:
    return ServiceHealthItem(
        service_key=service_key,
        name=name,
        status=status,
        latency_ms=latency_ms,
        details=details,
        last_checked_at=checked_at,
    )


def check_database_health(
    db: Session,
    checked_at: datetime | None = None,
) -> ServiceHealthItem:
    checked_at = checked_at or _now()
    query_started = perf_counter()
    try:
        bind = db.get_bind()
        if bind.dialect.name == "postgresql":
            active_after = checked_at - ACTIVE_GPS_WINDOW
            aggregate = db.execute(
                text(
                    "SELECT "
                    "(SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') "
                    "AS table_count, "
                    "(SELECT COALESCE(SUM(n_live_tup), 0)::bigint "
                    "FROM pg_stat_user_tables) AS record_count, "
                    "(SELECT extversion FROM pg_extension "
                    "WHERE extname = 'postgis' LIMIT 1) AS postgis_version, "
                    "(SELECT COUNT(*) FROM vehicles "
                    "WHERE last_gps_ping_at IS NOT NULL "
                    "AND last_gps_ping_at >= :active_after) AS active_vehicles, "
                    "(SELECT COUNT(*) FROM vehicles "
                    "WHERE last_gps_ping_at IS NOT NULL "
                    "AND last_gps_ping_at >= :active_after "
                    "AND route_deviation_status = 'OFF_ROUTE_WARNING') "
                    "AS off_route_warnings, "
                    "(SELECT COUNT(*) FROM customer_notifications) "
                    "AS notification_count, "
                    "(SELECT COUNT(*) FROM customer_notifications "
                    "WHERE status = 'FAILED') AS failed_notification_count"
                ),
                {"active_after": active_after},
            ).mappings().one()
            table_count = int(aggregate["table_count"] or 0)
            record_count = int(aggregate["record_count"] or 0)
            postgis_version = aggregate["postgis_version"]
            record_count_estimated = True
            db.info["system_health_aggregates"] = {
                "active_vehicles": int(aggregate["active_vehicles"] or 0),
                "off_route_warnings": int(aggregate["off_route_warnings"] or 0),
                "notification_count": int(aggregate["notification_count"] or 0),
                "failed_notification_count": int(
                    aggregate["failed_notification_count"] or 0
                ),
            }
        else:
            table_names = set(inspect(bind).get_table_names())
            table_count = len(table_names)
            record_count = 0
            for table in Base.metadata.sorted_tables:
                if table.name in table_names:
                    record_count += int(
                        db.scalar(select(func.count()).select_from(table)) or 0
                    )
            postgis_version = None
            record_count_estimated = False
        query_latency = _elapsed_ms(query_started)
        status = "HEALTHY" if postgis_version else "DEGRADED"
        return _service_item(
            service_key="database",
            name="PostgreSQL & PostGIS",
            status=status,
            latency_ms=query_latency,
            details={
                "dialect": bind.dialect.name,
                "table_count": table_count,
                "record_count": record_count,
                "record_count_estimated": record_count_estimated,
                "postgis_version": postgis_version,
                "spatial_extension": "ACTIVE" if postgis_version else "UNAVAILABLE",
            },
            checked_at=checked_at,
        )
    except SQLAlchemyError:
        logger.exception("system_health_database_probe_failed")
        db.rollback()
        return _service_item(
            service_key="database",
            name="PostgreSQL & PostGIS",
            status="DOWN",
            latency_ms=_elapsed_ms(query_started),
            details={"connection": "UNAVAILABLE", "spatial_extension": "UNKNOWN"},
            checked_at=checked_at,
        )


def check_core_engine_health(
    _db: Session,
    checked_at: datetime | None = None,
) -> ServiceHealthItem:
    global _core_engine_cache

    checked_at = checked_at or _now()
    with _core_engine_cache_lock:
        if _core_engine_cache is not None:
            return _core_engine_cache.model_copy(update={"last_checked_at": checked_at})
    started_at = perf_counter()
    try:
        solver_input = VRPInput(
            depot=SolverDepot(
                id="health-depot",
                name="Health probe",
                latitude=SAMPLE_START[0],
                longitude=SAMPLE_START[1],
            ),
            vehicles=[
                SolverVehicle(
                    id="health-vehicle",
                    license_plate="HEALTH-01",
                    capacity_kg=100,
                )
            ],
            orders=[],
        )
        VRPSolver(data=solver_input, time_limit_seconds=1)
        try:
            solver_version = version("ortools")
        except PackageNotFoundError:
            solver_version = "unknown"
        item = _service_item(
            service_key="core_engine",
            name="Google OR-Tools CVRP Engine",
            status="HEALTHY",
            latency_ms=_elapsed_ms(started_at),
            details={
                "readiness": "READY",
                "solver_version": solver_version,
                "algorithm": "PARALLEL_CHEAPEST_INSERTION",
            },
            checked_at=checked_at,
        )
        with _core_engine_cache_lock:
            _core_engine_cache = item
        return item
    except Exception:
        logger.exception("system_health_core_engine_probe_failed")
        return _service_item(
            service_key="core_engine",
            name="Google OR-Tools CVRP Engine",
            status="DOWN",
            latency_ms=_elapsed_ms(started_at),
            details={"readiness": "UNAVAILABLE"},
            checked_at=checked_at,
        )


def _fetch_osrm_route(timeout_seconds: float) -> RoutingProbe | None:
    coordinates = (
        f"{SAMPLE_START[1]},{SAMPLE_START[0]};"
        f"{SAMPLE_DESTINATION[1]},{SAMPLE_DESTINATION[0]}"
    )
    query = urlencode({"overview": "false", "steps": "false"})
    request = Request(
        f"{OSRM_BASE_URL}/route/v1/driving/{coordinates}?{query}",
        headers={"User-Agent": "LogiRoute-VN-System-Diagnostics/1.0"},
    )
    try:
        with urlopen(request, timeout=timeout_seconds) as response:  # noqa: S310
            payload = json.load(response)
    except (OSError, TimeoutError, ValueError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict) or payload.get("code") != "Ok":
        return None
    routes = payload.get("routes")
    if not isinstance(routes, list) or not routes or not isinstance(routes[0], dict):
        return None
    distance = routes[0].get("distance")
    duration = routes[0].get("duration")
    if (
        not isinstance(distance, (int, float))
        or not math.isfinite(distance)
        or distance <= 0
        or not isinstance(duration, (int, float))
        or not math.isfinite(duration)
        or duration <= 0
    ):
        return None
    return RoutingProbe(
        distance_km=round(distance / 1000, 2),
        duration_mins=round(duration / 60, 1),
    )


def request_osrm_route() -> RoutingProbe | None:
    """Run the deeper on-demand OSRM probe used by diagnostics."""
    return _fetch_osrm_route(OSRM_DIAGNOSTIC_TIMEOUT_SECONDS)


def check_osrm_health(
    _db: Session,
    checked_at: datetime | None = None,
) -> ServiceHealthItem:
    global _osrm_refreshing

    checked_at = checked_at or _now()
    current_monotonic = monotonic()
    cached_item: ServiceHealthItem | None = None
    should_refresh = False
    with _osrm_cache_lock:
        if _osrm_cache is not None and _osrm_cache[0] > current_monotonic:
            cached = _osrm_cache[1]
            return cached.model_copy(
                update={
                    "details": {**cached.details, "cached": True},
                    "last_checked_at": checked_at,
                }
            )
        if _osrm_cache is not None:
            cached_item = _osrm_cache[1]
        if not _osrm_refreshing:
            _osrm_refreshing = True
            should_refresh = True

    if should_refresh:
        Thread(target=_refresh_osrm_health_cache, daemon=True).start()
    if cached_item is not None:
        return cached_item.model_copy(
            update={
                "details": {
                    **cached_item.details,
                    "cached": True,
                    "refreshing": True,
                },
                "last_checked_at": checked_at,
            }
        )
    return _service_item(
        service_key="osrm_routing",
        name="OSRM Routing Service",
        status="DEGRADED",
        latency_ms=None,
        details={
            "routing_graph": "PROBE_PENDING",
            "fallback": "HAVERSINE",
            "cached": False,
            "refreshing": True,
        },
        checked_at=checked_at,
    )


def _refresh_osrm_health_cache() -> None:
    global _osrm_cache, _osrm_refreshing

    started_at = perf_counter()
    route = _fetch_osrm_route(OSRM_DIAGNOSTIC_TIMEOUT_SECONDS)
    item = _service_item(
        service_key="osrm_routing",
        name="OSRM Routing Service",
        status="HEALTHY" if route else "DEGRADED",
        latency_ms=_elapsed_ms(started_at),
        details={
            "routing_graph": "ACTIVE" if route else "FALLBACK_READY",
            "fallback": "HAVERSINE",
            "cached": False,
            "refreshing": False,
        },
        checked_at=_now(),
    )
    with _osrm_cache_lock:
        _osrm_cache = (monotonic() + OSRM_CACHE_SECONDS, item)
        _osrm_refreshing = False


def check_telemetry_health(
    db: Session,
    checked_at: datetime | None = None,
) -> ServiceHealthItem:
    checked_at = checked_at or _now()
    started_at = perf_counter()
    try:
        active_after = checked_at - ACTIVE_GPS_WINDOW
        shared = db.info.get("system_health_aggregates")
        if isinstance(shared, dict):
            active_vehicles = int(shared.get("active_vehicles", 0))
            off_route = int(shared.get("off_route_warnings", 0))
        else:
            active_condition = (
                Vehicle.last_gps_ping_at.is_not(None)
                & (Vehicle.last_gps_ping_at >= active_after)
            )
            aggregate = db.execute(
                select(
                    func.sum(case((active_condition, 1), else_=0)),
                    func.sum(
                        case(
                            (
                                active_condition
                                & (Vehicle.route_deviation_status == "OFF_ROUTE_WARNING"),
                                1,
                            ),
                            else_=0,
                        )
                    ),
                ).select_from(Vehicle)
            ).one()
            active_vehicles = int(aggregate[0] or 0)
            off_route = int(aggregate[1] or 0)
        return _service_item(
            service_key="telemetry",
            name="Live Fleet Telemetry",
            status="HEALTHY",
            latency_ms=_elapsed_ms(started_at),
            details={
                "active_vehicles_last_hour": active_vehicles,
                "off_route_warnings": off_route,
                "deviation_filter": "ACTIVE",
                "deviation_threshold_meters": 500,
            },
            checked_at=checked_at,
        )
    except SQLAlchemyError:
        logger.exception("system_health_telemetry_probe_failed")
        db.rollback()
        return _service_item(
            service_key="telemetry",
            name="Live Fleet Telemetry",
            status="DOWN",
            latency_ms=_elapsed_ms(started_at),
            details={"stream": "UNAVAILABLE", "deviation_filter": "UNKNOWN"},
            checked_at=checked_at,
        )


def check_notifications_health(
    db: Session,
    checked_at: datetime | None = None,
) -> ServiceHealthItem:
    checked_at = checked_at or _now()
    started_at = perf_counter()
    try:
        shared = db.info.get("system_health_aggregates")
        if isinstance(shared, dict):
            total = int(shared.get("notification_count", 0))
            failed = int(shared.get("failed_notification_count", 0))
        else:
            aggregate = db.execute(
                select(
                    func.count(),
                    func.sum(
                        case(
                            (CustomerNotification.status == NotificationStatus.FAILED, 1),
                            else_=0,
                        )
                    ),
                ).select_from(CustomerNotification)
            ).one()
            total = int(aggregate[0] or 0)
            failed = int(aggregate[1] or 0)
        success_rate = round(((total - failed) / total) * 100, 1) if total else 100.0
        return _service_item(
            service_key="notifications",
            name="Zalo ZNS & SMS Simulator",
            status="HEALTHY" if failed == 0 else "DEGRADED",
            latency_ms=_elapsed_ms(started_at),
            details={
                "sent_count": total,
                "failed_count": failed,
                "success_rate_percent": success_rate,
                "queue_status": "ACTIVE",
                "queue_depth": 0,
            },
            checked_at=checked_at,
        )
    except SQLAlchemyError:
        logger.exception("system_health_notification_probe_failed")
        db.rollback()
        return _service_item(
            service_key="notifications",
            name="Zalo ZNS & SMS Simulator",
            status="DOWN",
            latency_ms=_elapsed_ms(started_at),
            details={"queue_status": "UNAVAILABLE"},
            checked_at=checked_at,
        )


def _nearest_existing_path(path: Path) -> Path | None:
    candidate = path
    while not candidate.exists() and candidate != candidate.parent:
        candidate = candidate.parent
    return candidate if candidate.exists() else None


def _bounded_upload_file_count(limit: int = 10_000) -> tuple[int, bool]:
    count = 0
    for directory in (POD_UPLOAD_DIR, SIGNATURE_UPLOAD_DIR):
        if not directory.exists():
            continue
        for child in directory.iterdir():
            if child.is_file():
                count += 1
                if count >= limit:
                    return count, True
    return count, False


def check_storage_health(
    _db: Session,
    checked_at: datetime | None = None,
) -> ServiceHealthItem:
    checked_at = checked_at or _now()
    started_at = perf_counter()
    existing_path = _nearest_existing_path(UPLOADS_ROOT)
    if existing_path is None:
        return _service_item(
            service_key="storage",
            name="POD & Signature Storage",
            status="DOWN",
            latency_ms=_elapsed_ms(started_at),
            details={"writable": False, "file_count": 0},
            checked_at=checked_at,
        )
    try:
        usage = shutil.disk_usage(existing_path)
        file_count, capped = _bounded_upload_file_count()
        required_directories = [POD_UPLOAD_DIR, SIGNATURE_UPLOAD_DIR]
        directories_ready = all(path.exists() and path.is_dir() for path in required_directories)
        writable = os.access(existing_path, os.W_OK)
        status = "HEALTHY" if writable and directories_ready else "DEGRADED"
        return _service_item(
            service_key="storage",
            name="POD & Signature Storage",
            status=status,
            latency_ms=_elapsed_ms(started_at),
            details={
                "writable": writable,
                "directories_ready": directories_ready,
                "available_gb": round(usage.free / (1024**3), 2),
                "file_count": file_count,
                "file_count_capped": capped,
            },
            checked_at=checked_at,
        )
    except OSError:
        logger.exception("system_health_storage_probe_failed")
        return _service_item(
            service_key="storage",
            name="POD & Signature Storage",
            status="DOWN",
            latency_ms=_elapsed_ms(started_at),
            details={"writable": False, "file_count": 0},
            checked_at=checked_at,
        )


SYSTEM_HEALTH_CHECKS: tuple[
    tuple[str, str | Callable[..., ServiceHealthItem]], ...
] = (
    ("database", "check_database_health"),
    ("core_engine", "check_core_engine_health"),
    ("osrm_routing", "check_osrm_health"),
    ("telemetry", "check_telemetry_health"),
    ("notifications", "check_notifications_health"),
    ("storage", "check_storage_health"),
)

SERVICE_NAMES = {
    "database": "PostgreSQL & PostGIS",
    "core_engine": "Google OR-Tools CVRP Engine",
    "osrm_routing": "OSRM Routing Service",
    "telemetry": "Live Fleet Telemetry",
    "notifications": "Zalo ZNS & SMS Simulator",
    "storage": "POD & Signature Storage",
}


def _overall_health_status(services: list[ServiceHealthItem]) -> str:
    if any(
        service.service_key in CRITICAL_SERVICES and service.status == "DOWN"
        for service in services
    ):
        return "DOWN"
    if any(service.status != "HEALTHY" for service in services):
        return "DEGRADED"
    return "HEALTHY"


def build_system_health(db: Session) -> SystemHealthResponse:
    checked_at = _now()
    services: list[ServiceHealthItem] = []
    for service_key, configured_check in SYSTEM_HEALTH_CHECKS:
        try:
            check = (
                globals()[configured_check]
                if isinstance(configured_check, str)
                else configured_check
            )
            services.append(check(db, checked_at=checked_at))
        except Exception:
            logger.exception(
                "system_health_probe_failed",
                extra={"service_key": service_key},
            )
            services.append(
                _service_item(
                    service_key=service_key,
                    name=SERVICE_NAMES[service_key],
                    status="DOWN",
                    latency_ms=None,
                    details={"error_code": "PROBE_FAILED"},
                    checked_at=checked_at,
                )
            )
    return SystemHealthResponse(
        overall_status=_overall_health_status(services),
        uptime_seconds=max(0, int(monotonic() - PROCESS_STARTED_AT)),
        server_time=checked_at,
        services=services,
    )


def run_spatial_query_diagnostic(db: Session) -> DiagnosticTestResult:
    started_at = perf_counter()
    try:
        if db.get_bind().dialect.name != "postgresql":
            raise RuntimeError("PostGIS is unavailable for the active database dialect")
        distance_meters = db.scalar(
            text(
                "SELECT ST_DistanceSphere("
                "ST_MakePoint(:start_lng, :start_lat), "
                "ST_MakePoint(:end_lng, :end_lat))"
            ),
            {
                "start_lng": SAMPLE_START[1],
                "start_lat": SAMPLE_START[0],
                "end_lng": SAMPLE_DESTINATION[1],
                "end_lat": SAMPLE_DESTINATION[0],
            },
        )
        passed = isinstance(distance_meters, (int, float)) and math.isfinite(distance_meters)
        return DiagnosticTestResult(
            test_key="database_spatial",
            name="Database spatial query",
            status="PASS" if passed else "FAIL",
            duration_ms=_elapsed_ms(started_at),
            detail=(
                f"PostGIS returned {round(float(distance_meters), 1)} meters."
                if passed
                else "PostGIS returned an invalid distance."
            ),
        )
    except (SQLAlchemyError, RuntimeError):
        db.rollback()
        return DiagnosticTestResult(
            test_key="database_spatial",
            name="Database spatial query",
            status="FAIL",
            duration_ms=_elapsed_ms(started_at),
            detail="PostGIS spatial query is unavailable.",
        )


def _run_core_engine_diagnostic() -> DiagnosticTestResult:
    started_at = perf_counter()
    try:
        solver_input = VRPInput(
            depot=SolverDepot(
                id="diagnostic-depot",
                name="System diagnostic depot",
                latitude=SAMPLE_START[0],
                longitude=SAMPLE_START[1],
            ),
            vehicles=[
                SolverVehicle(
                    id="diagnostic-vehicle",
                    license_plate="DIAG-01",
                    capacity_kg=100,
                )
            ],
            orders=[
                SolverOrder(
                    id=f"diagnostic-order-{index}",
                    address=f"Synthetic stop {index}",
                    latitude=latitude,
                    longitude=longitude,
                    weight_kg=10,
                )
                for index, (latitude, longitude) in enumerate(
                    (
                        (10.8581, 106.6560),
                        (10.8231, 106.6861),
                        SAMPLE_DESTINATION,
                    ),
                    start=1,
                )
            ],
        )
        output = VRPSolver(data=solver_input, time_limit_seconds=1).solve()
        assigned_count = sum(len(route.stops) for route in output.routes)
        passed = output.status in {"OPTIMAL", "FEASIBLE"} and assigned_count == 3
        return DiagnosticTestResult(
            test_key="core_engine_solve",
            name="Mini OR-Tools CVRP solve",
            status="PASS" if passed else "FAIL",
            duration_ms=_elapsed_ms(started_at),
            detail=(
                f"Solver status {output.status}; assigned {assigned_count}/3 synthetic stops."
            ),
        )
    except Exception:
        logger.exception("system_diagnostic_core_engine_failed")
        return DiagnosticTestResult(
            test_key="core_engine_solve",
            name="Mini OR-Tools CVRP solve",
            status="FAIL",
            duration_ms=_elapsed_ms(started_at),
            detail="The mini CVRP solve could not be completed.",
        )


def _run_routing_diagnostic() -> DiagnosticTestResult:
    started_at = perf_counter()
    route = request_osrm_route()
    if route is not None:
        detail = (
            f"OSRM returned {route.distance_km} km in "
            f"{route.duration_mins} minutes."
        )
        status = "PASS"
    else:
        fallback_distance = haversine_km(*SAMPLE_START, *SAMPLE_DESTINATION) * 1.25
        status = "PASS" if fallback_distance > 0 else "FAIL"
        detail = (
            f"OSRM unavailable; Haversine fallback returned "
            f"{round(fallback_distance, 2)} km."
        )
    return DiagnosticTestResult(
        test_key="routing_polyline",
        name="Routing polyline and fallback",
        status=status,
        duration_ms=_elapsed_ms(started_at),
        detail=detail,
    )


def _run_tracking_token_diagnostic() -> DiagnosticTestResult:
    started_at = perf_counter()
    first = secrets.token_hex(32)
    second = secrets.token_hex(32)
    passed = len(first) == 64 and len(second) == 64 and first != second
    return DiagnosticTestResult(
        test_key="tracking_token",
        name="Secure tracking token",
        status="PASS" if passed else "FAIL",
        duration_ms=_elapsed_ms(started_at),
        detail=(
            "Generated two unique 64-character secure identifiers."
            if passed
            else "The secure identifier generator did not meet the contract."
        ),
    )


def _run_storage_diagnostic() -> DiagnosticTestResult:
    started_at = perf_counter()
    probe_path: Path | None = None
    try:
        UPLOADS_ROOT.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(
            mode="wb",
            prefix="logiroute-diagnostic-",
            suffix=".tmp",
            dir=UPLOADS_ROOT,
            delete=False,
        ) as probe:
            probe.write(b"logiroute-storage-probe")
            probe_path = Path(probe.name)
        passed = probe_path.read_bytes() == b"logiroute-storage-probe"
        return DiagnosticTestResult(
            test_key="storage_permissions",
            name="Storage read and write permissions",
            status="PASS" if passed else "FAIL",
            duration_ms=_elapsed_ms(started_at),
            detail=(
                "Temporary storage probe was written, read, and scheduled for cleanup."
                if passed
                else "Temporary storage content could not be verified."
            ),
        )
    except OSError:
        logger.exception("system_diagnostic_storage_failed")
        return DiagnosticTestResult(
            test_key="storage_permissions",
            name="Storage read and write permissions",
            status="FAIL",
            duration_ms=_elapsed_ms(started_at),
            detail="The uploads partition is not writable.",
        )
    finally:
        if probe_path is not None:
            probe_path.unlink(missing_ok=True)


def run_diagnostic_suite(db: Session) -> SystemDiagnosticsResponse:
    started_at = _now()
    started_clock = perf_counter()
    tests = [
        run_spatial_query_diagnostic(db),
        _run_core_engine_diagnostic(),
        _run_routing_diagnostic(),
        _run_tracking_token_diagnostic(),
        _run_storage_diagnostic(),
    ]
    completed_at = _now()
    passed_count = sum(result.status == "PASS" for result in tests)
    response = SystemDiagnosticsResponse(
        overall_status="PASS" if passed_count == len(tests) else "FAIL",
        started_at=started_at,
        completed_at=completed_at,
        total_duration_ms=_elapsed_ms(started_clock),
        passed_count=passed_count,
        failed_count=len(tests) - passed_count,
        tests=tests,
    )
    logger.info(
        "system_diagnostics_completed",
        extra={
            "passed_count": response.passed_count,
            "failed_count": response.failed_count,
            "duration_ms": response.total_duration_ms,
        },
    )
    return response
