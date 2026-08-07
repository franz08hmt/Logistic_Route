"""Transactional manual route reordering with resilient metric recalculation."""

from dataclasses import dataclass
import json
import logging
import math
import os
from typing import Iterable
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.db.models import (
    Depot,
    Order,
    OrderStatus,
    RouteAnalyticsSnapshot,
    User,
    Vehicle,
    VehicleStatus,
)
from app.schemas import RouteReorderRequest
from app.services.activity_logger import log_order_activity
from app.services.cost_calculator import CostCalculation, calculate_route_costs
from core_engine.solver import Route, Stop, VRPOutput


logger = logging.getLogger(__name__)
ACTIVE_ROUTE_STATUSES = (OrderStatus.ASSIGNED, OrderStatus.DELIVERING)
OSRM_BASE_URL = os.getenv("OSRM_BASE_URL", "https://router.project-osrm.org")
OSRM_TIMEOUT_SECONDS = 2.0
ROAD_CURVATURE_FACTOR = 1.25
FALLBACK_SPEED_KMH = 20.0
EARTH_RADIUS_KM = 6_371.0


@dataclass(frozen=True)
class RouteMetrics:
    distance_km: float
    duration_mins: float


@dataclass(frozen=True)
class RouteReorderRun:
    route_batch_id: UUID
    depot: Depot
    result: VRPOutput
    cost_metrics: CostCalculation


class RouteReorderError(Exception):
    def __init__(self, status_code: int, detail: str | dict[str, object]) -> None:
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail


def _abort(
    db: Session,
    status_code: int,
    detail: str | dict[str, object],
) -> None:
    db.rollback()
    raise RouteReorderError(status_code, detail)


def _haversine_km(
    first_latitude: float,
    first_longitude: float,
    second_latitude: float,
    second_longitude: float,
) -> float:
    first_latitude_rad = math.radians(first_latitude)
    second_latitude_rad = math.radians(second_latitude)
    latitude_delta = math.radians(second_latitude - first_latitude)
    longitude_delta = math.radians(second_longitude - first_longitude)
    value = (
        math.sin(latitude_delta / 2) ** 2
        + math.cos(first_latitude_rad)
        * math.cos(second_latitude_rad)
        * math.sin(longitude_delta / 2) ** 2
    )
    return EARTH_RADIUS_KM * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


def fallback_route_metrics(depot: Depot, stops: list[Order]) -> RouteMetrics:
    if not stops:
        return RouteMetrics(distance_km=0.0, duration_mins=0.0)
    points = [depot, *stops, depot]
    direct_distance = sum(
        _haversine_km(
            first.latitude,
            first.longitude,
            second.latitude,
            second.longitude,
        )
        for first, second in zip(points, points[1:])
    )
    distance_km = round(direct_distance * ROAD_CURVATURE_FACTOR, 2)
    return RouteMetrics(
        distance_km=distance_km,
        duration_mins=round((distance_km / FALLBACK_SPEED_KMH) * 60, 1),
    )


def request_osrm_metrics(
    depot: Depot,
    stops: list[Order],
    *,
    timeout_seconds: float = OSRM_TIMEOUT_SECONDS,
) -> RouteMetrics | None:
    """Return validated OSRM route metrics or None so callers can fall back."""
    if not stops:
        return RouteMetrics(distance_km=0.0, duration_mins=0.0)
    points = [depot, *stops, depot]
    coordinates = ";".join(
        f"{point.longitude},{point.latitude}" for point in points
    )
    query = urlencode({"overview": "false", "steps": "false"})
    url = f"{OSRM_BASE_URL.rstrip('/')}/route/v1/driving/{coordinates}?{query}"
    request = Request(url, headers={"User-Agent": "LogiRoute-VN/1.0"})
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
    distance_meters = routes[0].get("distance")
    duration_seconds = routes[0].get("duration")
    if (
        not isinstance(distance_meters, (int, float))
        or not math.isfinite(distance_meters)
        or distance_meters < 0
        or not isinstance(duration_seconds, (int, float))
        or not math.isfinite(duration_seconds)
        or duration_seconds < 0
    ):
        return None
    return RouteMetrics(
        distance_km=round(distance_meters / 1000, 2),
        duration_mins=round(duration_seconds / 60, 1),
    )


def _orders_for_route(
    route_order_ids: Iterable[UUID],
    orders_by_id: dict[UUID, Order],
) -> list[Order]:
    return [orders_by_id[order_id] for order_id in route_order_ids]


def reorder_routes(
    db: Session,
    *,
    payload: RouteReorderRequest,
    actor: User | None = None,
) -> RouteReorderRun:
    """Validate, recalculate, and persist a complete editable route batch."""
    depot = db.scalar(select(Depot).order_by(Depot.name, Depot.id).limit(1))
    if depot is None:
        _abort(db, 404, "No depot is configured")

    vehicle_ids = [route.vehicle_id for route in payload.routes]
    vehicles = list(
        db.scalars(
            select(Vehicle)
            .where(Vehicle.id.in_(vehicle_ids))
            .order_by(Vehicle.license_plate)
            .with_for_update()
        ).all()
    )
    if len(vehicles) != len(vehicle_ids):
        _abort(db, 404, "One or more vehicles were not found")
    vehicles_by_id = {vehicle.id: vehicle for vehicle in vehicles}

    batch_orders = list(
        db.scalars(
            select(Order)
            .where(Order.route_batch_id == payload.route_batch_id)
            .order_by(Order.order_code)
            .with_for_update()
        ).all()
    )
    if not batch_orders:
        _abort(db, 404, "Route batch was not found")
    if any(order.status != OrderStatus.ASSIGNED for order in batch_orders):
        _abort(
            db,
            409,
            {
                "code": "ROUTE_ALREADY_IN_PROGRESS",
                "message": "Only fully assigned routes can be manually reordered",
            },
        )

    requested_order_ids = {
        stop.order_id for route in payload.routes for stop in route.stops
    }
    batch_order_ids = {order.id for order in batch_orders}
    if requested_order_ids != batch_order_ids:
        _abort(
            db,
            409,
            {
                "code": "ROUTE_BATCH_MISMATCH",
                "message": "The reorder request must include every order in the route batch",
            },
        )

    original_vehicle_ids = {
        order.assigned_vehicle_id
        for order in batch_orders
        if order.assigned_vehicle_id is not None
    }
    if not original_vehicle_ids.issubset(set(vehicle_ids)):
        _abort(
            db,
            409,
            {
                "code": "ROUTE_VEHICLE_MISMATCH",
                "message": (
                    "The reorder request must retain every currently assigned vehicle; "
                    "send an empty stop list for a vacated vehicle"
                ),
            },
        )

    conflicting_order = db.scalar(
        select(Order.id)
        .where(
            Order.assigned_vehicle_id.in_(vehicle_ids),
            or_(
                Order.route_batch_id.is_(None),
                Order.route_batch_id != payload.route_batch_id,
            ),
            Order.status.in_(ACTIVE_ROUTE_STATUSES),
        )
        .limit(1)
    )
    if conflicting_order is not None:
        _abort(
            db,
            409,
            {
                "code": "VEHICLE_HAS_OTHER_ROUTE",
                "message": "One or more vehicles already have another active route",
            },
        )

    orders_by_id = {order.id: order for order in batch_orders}
    ordered_routes: list[tuple[Vehicle, list[Order]]] = []
    for route_input in payload.routes:
        vehicle = vehicles_by_id[route_input.vehicle_id]
        sorted_stops = sorted(route_input.stops, key=lambda stop: stop.stop_sequence)
        route_orders = _orders_for_route(
            (stop.order_id for stop in sorted_stops),
            orders_by_id,
        )
        total_weight_kg = round(sum(order.weight_kg for order in route_orders), 2)
        if total_weight_kg > vehicle.capacity_kg:
            _abort(
                db,
                409,
                {
                    "code": "VEHICLE_CAPACITY_EXCEEDED",
                    "message": f"Vehicle {vehicle.license_plate} exceeds its capacity",
                    "vehicle_id": str(vehicle.id),
                    "license_plate": vehicle.license_plate,
                    "total_weight_kg": total_weight_kg,
                    "capacity_kg": vehicle.capacity_kg,
                },
            )
        ordered_routes.append((vehicle, route_orders))

    result_routes: list[Route] = []
    total_distance_km = 0.0
    total_duration_mins = 0.0
    for vehicle, route_orders in ordered_routes:
        metrics = request_osrm_metrics(depot, route_orders)
        if metrics is None:
            metrics = fallback_route_metrics(depot, route_orders)
        total_distance_km += metrics.distance_km
        total_duration_mins += metrics.duration_mins
        result_routes.append(
            Route(
                vehicle_id=str(vehicle.id),
                license_plate=vehicle.license_plate,
                total_weight_kg=round(sum(order.weight_kg for order in route_orders), 2),
                distance_km=metrics.distance_km,
                stops=[
                    Stop(
                        stop_sequence=index,
                        order_id=str(order.id),
                        address=order.address,
                        latitude=order.latitude,
                        longitude=order.longitude,
                    )
                    for index, order in enumerate(route_orders, start=1)
                ],
            )
        )

    changes: list[tuple[Order, UUID | None, int | None]] = []
    for vehicle, route_orders in ordered_routes:
        for sequence, order in enumerate(route_orders, start=1):
            if order.assigned_vehicle_id != vehicle.id or order.stop_sequence != sequence:
                changes.append((order, order.assigned_vehicle_id, order.stop_sequence))
            order.assigned_vehicle_id = vehicle.id
            order.stop_sequence = sequence
            order.route_batch_id = payload.route_batch_id

    db.flush()
    for vehicle, route_orders in ordered_routes:
        vehicle.status = VehicleStatus.ON_ROUTE if route_orders else VehicleStatus.IDLE
    for order, previous_vehicle_id, previous_sequence in changes:
        log_order_activity(
            db,
            order_id=order.id,
            action="ASSIGNED",
            actor=actor,
            old_status=OrderStatus.ASSIGNED.value,
            new_status=OrderStatus.ASSIGNED.value,
            detail=(
                "Manual route adjustment: "
                f"vehicle {previous_vehicle_id or '-'} stop {previous_sequence or '-'} "
                f"-> vehicle {order.assigned_vehicle_id} stop {order.stop_sequence}"
            ),
        )

    total_distance_km = round(total_distance_km, 2)
    total_duration_mins = round(total_duration_mins, 1)
    cost_metrics = calculate_route_costs(
        total_distance_km=total_distance_km,
        total_time_minutes=total_duration_mins,
    )
    result = VRPOutput(
        status="MANUALLY_REORDERED",
        total_distance_km=total_distance_km,
        total_duration_mins=total_duration_mins,
        unassigned_orders=[],
        routes=result_routes,
    )
    db.add(
        RouteAnalyticsSnapshot(
            total_distance_km=total_distance_km,
            total_duration_mins=total_duration_mins,
            fuel_cost_vnd=cost_metrics.fuel_cost_vnd,
            driver_cost_vnd=cost_metrics.driver_cost_vnd,
            total_cost_vnd=cost_metrics.total_cost_vnd,
            co2_emissions_kg=cost_metrics.co2_emissions_kg,
            estimated_savings_vnd=cost_metrics.estimated_savings_vnd,
            estimated_co2_savings_kg=cost_metrics.estimated_co2_savings_kg,
            savings_rate=cost_metrics.savings_rate,
        )
    )
    try:
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("manual_route_reorder_commit_failed batch_id=%s", payload.route_batch_id)
        raise

    logger.info(
        "manual_route_reorder_completed batch_id=%s vehicle_count=%s stop_count=%s",
        payload.route_batch_id,
        len(ordered_routes),
        len(batch_orders),
    )
    return RouteReorderRun(
        route_batch_id=payload.route_batch_id,
        depot=depot,
        result=result,
        cost_metrics=cost_metrics,
    )
