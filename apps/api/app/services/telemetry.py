import math
from collections.abc import Iterable
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Depot, Order, OrderStatus, Vehicle
from app.services.depot_scope import resolve_depot


EARTH_RADIUS_KM = 6_371.0088
ROUTE_DEVIATION_THRESHOLD_KM = 0.5
ACTIVE_TELEMETRY_ORDER_STATUSES = (OrderStatus.DELIVERING, OrderStatus.ASSIGNED)
GeoPoint = tuple[float, float]


def _to_radians(point: GeoPoint) -> GeoPoint:
    return math.radians(point[0]), math.radians(point[1])


def haversine_distance_km(start: GeoPoint, end: GeoPoint) -> float:
    """Return great-circle distance between two latitude/longitude points."""
    start_lat, start_lon = _to_radians(start)
    end_lat, end_lon = _to_radians(end)
    latitude_delta = end_lat - start_lat
    longitude_delta = end_lon - start_lon
    a = (
        math.sin(latitude_delta / 2) ** 2
        + math.cos(start_lat)
        * math.cos(end_lat)
        * math.sin(longitude_delta / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * math.asin(min(1.0, math.sqrt(a)))


def calculate_perpendicular_distance(
    point: GeoPoint,
    line_start: GeoPoint,
    line_end: GeoPoint,
) -> float:
    """Distance in km from a GPS point to the closest point on a route segment."""
    reference_latitude = math.radians(
        (point[0] + line_start[0] + line_end[0]) / 3
    )

    def project(candidate: GeoPoint) -> tuple[float, float]:
        latitude, longitude = _to_radians(candidate)
        return (
            EARTH_RADIUS_KM * longitude * math.cos(reference_latitude),
            EARTH_RADIUS_KM * latitude,
        )

    point_xy = project(point)
    start_xy = project(line_start)
    end_xy = project(line_end)
    segment_x = end_xy[0] - start_xy[0]
    segment_y = end_xy[1] - start_xy[1]
    segment_length_squared = segment_x**2 + segment_y**2
    if segment_length_squared == 0:
        return haversine_distance_km(point, line_start)

    projection = (
        (point_xy[0] - start_xy[0]) * segment_x
        + (point_xy[1] - start_xy[1]) * segment_y
    ) / segment_length_squared
    bounded_projection = max(0.0, min(1.0, projection))
    closest_point = (
        line_start[0] + bounded_projection * (line_end[0] - line_start[0]),
        line_start[1] + bounded_projection * (line_end[1] - line_start[1]),
    )
    return haversine_distance_km(point, closest_point)


def find_next_active_stops(
    db: Session,
    vehicle_ids: Iterable[UUID],
) -> dict[UUID, Order]:
    ids = tuple(vehicle_ids)
    if not ids:
        return {}
    orders = db.scalars(
        select(Order)
        .where(
            Order.assigned_vehicle_id.in_(ids),
            Order.status.in_(ACTIVE_TELEMETRY_ORDER_STATUSES),
        )
        .order_by(
            Order.assigned_vehicle_id,
            Order.stop_sequence.nulls_last(),
            Order.order_code,
        )
    ).all()
    next_stops: dict[UUID, Order] = {}
    for order in orders:
        if order.assigned_vehicle_id is not None:
            next_stops.setdefault(order.assigned_vehicle_id, order)
    return next_stops


def find_next_active_stop(db: Session, vehicle_id: UUID) -> Order | None:
    return find_next_active_stops(db, (vehicle_id,)).get(vehicle_id)


def _find_segment_start(
    db: Session,
    *,
    vehicle_id: UUID,
    next_stop: Order,
) -> GeoPoint | None:
    previous_stop = None
    if next_stop.route_batch_id is not None and next_stop.stop_sequence is not None:
        previous_stop = db.scalar(
            select(Order)
            .where(
                Order.assigned_vehicle_id == vehicle_id,
                Order.route_batch_id == next_stop.route_batch_id,
                Order.stop_sequence < next_stop.stop_sequence,
            )
            .order_by(Order.stop_sequence.desc())
            .limit(1)
        )
    if previous_stop is not None:
        return previous_stop.latitude, previous_stop.longitude

    depot = resolve_depot(db, next_stop.depot_id)
    if depot is None:
        return None
    return depot.latitude, depot.longitude


def calculate_vehicle_deviation_status(
    db: Session,
    *,
    vehicle: Vehicle,
    latitude: float,
    longitude: float,
    next_stop: Order | None = None,
) -> str:
    """Classify a GPS ping against the vehicle's current route segment."""
    active_stop = next_stop or find_next_active_stop(db, vehicle.id)
    if active_stop is None:
        return "ON_ROUTE"
    segment_start = _find_segment_start(
        db,
        vehicle_id=vehicle.id,
        next_stop=active_stop,
    )
    if segment_start is None:
        return "ON_ROUTE"
    distance_km = calculate_perpendicular_distance(
        (latitude, longitude),
        segment_start,
        (active_stop.latitude, active_stop.longitude),
    )
    return (
        "OFF_ROUTE_WARNING"
        if distance_km > ROUTE_DEVIATION_THRESHOLD_KM
        else "ON_ROUTE"
    )
