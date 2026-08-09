from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.v1.system import get_system_health, run_system_diagnostics
from app.core.security import get_password_hash, require_roles
from app.db.base import Base
from app.db.models import Order, User, UserRole, UserStatus
from app.schemas import DiagnosticTestResult, ServiceHealthItem
from app.services import system_diagnostics


def _engine():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return engine


def _admin() -> User:
    return User(
        email="system.admin@test.vn",
        hashed_password=get_password_hash("123456"),
        full_name="System Admin",
        role=UserRole.ADMIN,
        status=UserStatus.ACTIVE,
    )


def _health_item(service_key: str, status: str = "HEALTHY") -> ServiceHealthItem:
    return ServiceHealthItem(
        service_key=service_key,
        name=service_key.replace("_", " ").title(),
        status=status,
        latency_ms=1.5,
        details={"probe": "ok"},
        last_checked_at=datetime.now(timezone.utc),
    )


def test_system_health_returns_six_ordered_services_and_critical_aggregation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service_keys = [
        "database",
        "core_engine",
        "osrm_routing",
        "telemetry",
        "notifications",
        "storage",
    ]
    checks = [
        "check_database_health",
        "check_core_engine_health",
        "check_osrm_health",
        "check_telemetry_health",
        "check_notifications_health",
        "check_storage_health",
    ]
    for check_name, service_key in zip(checks, service_keys, strict=True):
        monkeypatch.setattr(
            system_diagnostics,
            check_name,
            lambda *args, key=service_key, **kwargs: _health_item(key),
        )

    with Session(_engine()) as db:
        response = get_system_health(db, _admin())

    assert response.overall_status == "HEALTHY"
    assert response.uptime_seconds >= 0
    assert [service.service_key for service in response.services] == service_keys

    monkeypatch.setattr(
        system_diagnostics,
        "check_database_health",
        lambda *args, **kwargs: _health_item("database", "DOWN"),
    )
    with Session(_engine()) as db:
        response = get_system_health(db, _admin())
    assert response.overall_status == "DOWN"


def test_noncritical_service_failure_degrades_but_does_not_mark_system_down(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        system_diagnostics,
        "SYSTEM_HEALTH_CHECKS",
        (
            ("database", lambda *args, **kwargs: _health_item("database")),
            ("core_engine", lambda *args, **kwargs: _health_item("core_engine")),
            (
                "osrm_routing",
                lambda *args, **kwargs: _health_item("osrm_routing", "DEGRADED"),
            ),
            ("telemetry", lambda *args, **kwargs: _health_item("telemetry")),
            (
                "notifications",
                lambda *args, **kwargs: _health_item("notifications"),
            ),
            ("storage", lambda *args, **kwargs: _health_item("storage")),
        ),
    )

    with Session(_engine()) as db:
        response = system_diagnostics.build_system_health(db)

    assert response.overall_status == "DEGRADED"


def test_unexpected_probe_error_is_isolated_from_the_health_endpoint(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def broken_storage_probe(*args, **kwargs):
        raise RuntimeError("simulated probe failure")

    monkeypatch.setattr(
        system_diagnostics,
        "SYSTEM_HEALTH_CHECKS",
        (
            ("database", lambda *args, **kwargs: _health_item("database")),
            ("core_engine", lambda *args, **kwargs: _health_item("core_engine")),
            ("osrm_routing", lambda *args, **kwargs: _health_item("osrm_routing")),
            ("telemetry", lambda *args, **kwargs: _health_item("telemetry")),
            (
                "notifications",
                lambda *args, **kwargs: _health_item("notifications"),
            ),
            ("storage", broken_storage_probe),
        ),
    )

    with Session(_engine()) as db:
        response = system_diagnostics.build_system_health(db)

    storage = next(item for item in response.services if item.service_key == "storage")
    assert response.overall_status == "DEGRADED"
    assert storage.status == "DOWN"
    assert storage.details["error_code"] == "PROBE_FAILED"


def test_osrm_health_probe_is_started_in_background_without_blocking(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    started_targets: list[object] = []

    class FakeThread:
        def __init__(self, *, target, daemon):
            assert daemon is True
            self.target = target

        def start(self) -> None:
            started_targets.append(self.target)

    monkeypatch.setattr(system_diagnostics, "_osrm_cache", None)
    monkeypatch.setattr(system_diagnostics, "_osrm_refreshing", False)
    monkeypatch.setattr(system_diagnostics, "Thread", FakeThread)
    monkeypatch.setattr(
        system_diagnostics,
        "_fetch_osrm_route",
        lambda timeout: pytest.fail("OSRM must not run synchronously in health"),
    )

    item = system_diagnostics.check_osrm_health(None)  # type: ignore[arg-type]

    assert item.status == "DEGRADED"
    assert item.latency_ms is None
    assert item.details["routing_graph"] == "PROBE_PENDING"
    assert started_targets == [system_diagnostics._refresh_osrm_health_cache]


def test_diagnostics_are_non_destructive_and_clean_up_storage_probe(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setattr(system_diagnostics, "UPLOADS_ROOT", tmp_path)
    monkeypatch.setattr(
        system_diagnostics,
        "run_spatial_query_diagnostic",
        lambda db: DiagnosticTestResult(
            test_key="database_spatial",
            name="Database spatial query",
            status="PASS",
            duration_ms=1.0,
            detail="PostGIS spatial query returned a finite distance.",
        ),
    )
    monkeypatch.setattr(system_diagnostics, "request_osrm_route", lambda: None)

    engine = _engine()
    with Session(engine) as db:
        before = db.scalar(select(func.count()).select_from(Order))
        response = run_system_diagnostics(db, _admin())
        after = db.scalar(select(func.count()).select_from(Order))

    assert response.overall_status == "PASS"
    assert response.passed_count == 5
    assert response.failed_count == 0
    assert [result.test_key for result in response.tests] == [
        "database_spatial",
        "core_engine_solve",
        "routing_polyline",
        "tracking_token",
        "storage_permissions",
    ]
    assert before == after == 0
    assert not list(tmp_path.glob("logiroute-diagnostic-*"))
    routing = next(result for result in response.tests if result.test_key == "routing_polyline")
    assert "Haversine" in routing.detail


def test_system_endpoints_require_admin_role() -> None:
    driver = User(
        email="system.driver@test.vn",
        hashed_password=get_password_hash("123456"),
        full_name="System Driver",
        role=UserRole.DRIVER,
        status=UserStatus.ACTIVE,
    )
    system_role_policy = require_roles(UserRole.ADMIN)

    with pytest.raises(HTTPException) as forbidden:
        system_role_policy(current_user=driver)

    assert forbidden.value.status_code == 403
