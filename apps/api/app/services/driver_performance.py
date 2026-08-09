from collections import defaultdict
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Depot, Order, OrderStatus, User, UserRole, Vehicle
from app.schemas import DriverPerformanceItem, DriverPerformanceResponse
from app.services.cost_calculator import calculate_route_costs
from app.services.telemetry import haversine_distance_km


TERMINAL_ORDER_STATUSES = (OrderStatus.DELIVERED, OrderStatus.FAILED)
ROAD_SHAPE_FACTOR = 1.25
DEFAULT_ADHERENCE_SCORE = 95.0


def _route_adherence_score(vehicle: Vehicle | None) -> float:
    """Estimate adherence from the latest signal until GPS history is persisted.

    The telemetry model currently stores one latest deviation state, not a ping
    history. Keeping this mapping isolated makes it possible to switch to a true
    ON_ROUTE/OFF_ROUTE ratio later without changing the public API contract.
    """
    if vehicle is None or vehicle.route_deviation_status in {None, "STOPPED"}:
        return DEFAULT_ADHERENCE_SCORE
    if vehicle.route_deviation_status == "OFF_ROUTE_WARNING":
        return 90.0
    return 98.0


def _route_distance_km(
    orders: list[Order],
    *,
    vehicle: Vehicle,
    depots_by_id: dict[UUID, Depot],
    default_depot: Depot | None,
) -> float:
    grouped_routes: dict[UUID, list[Order]] = defaultdict(list)
    for order in orders:
        grouped_routes[order.route_batch_id or order.id].append(order)

    total_distance = 0.0
    for route_orders in grouped_routes.values():
        route_orders.sort(
            key=lambda order: (
                order.stop_sequence is None,
                order.stop_sequence or 0,
                order.order_code,
            )
        )
        depot_id = route_orders[0].depot_id or vehicle.depot_id
        depot = depots_by_id.get(depot_id) if depot_id is not None else default_depot
        if depot is None:
            continue

        depot_point = (depot.latitude, depot.longitude)
        previous_point = depot_point
        for order in route_orders:
            stop_point = (order.latitude, order.longitude)
            total_distance += haversine_distance_km(previous_point, stop_point)
            previous_point = stop_point
        total_distance += haversine_distance_km(previous_point, depot_point)

    return total_distance * ROAD_SHAPE_FACTOR


def _tier_for_score(score: float) -> str:
    if score >= 90:
        return "GOLD"
    if score >= 75:
        return "SILVER"
    return "BRONZE"


def build_driver_performance_report(
    db: Session,
    *,
    days: int,
    depot_id: UUID | None = None,
    now: datetime | None = None,
) -> DriverPerformanceResponse:
    if days not in {7, 14, 30}:
        raise ValueError("days must be one of 7, 14 or 30")

    reference = now or datetime.now(timezone.utc)
    cutoff = reference - timedelta(days=days)
    driver_statement = select(User).where(User.role == UserRole.DRIVER)
    drivers = list(db.scalars(driver_statement.order_by(User.full_name, User.id)).all())
    if not drivers:
        return DriverPerformanceResponse(
            period_days=days,
            total_co2_saved_all_kg=0,
            drivers=[],
        )

    vehicles_statement = select(Vehicle).where(
        Vehicle.driver_id.in_([driver.id for driver in drivers])
    )
    if depot_id is not None:
        vehicles_statement = vehicles_statement.where(Vehicle.depot_id == depot_id)
    vehicles = list(
        db.scalars(
            vehicles_statement.order_by(Vehicle.driver_id, Vehicle.license_plate)
        ).all()
    )
    vehicle_by_driver: dict[UUID, Vehicle] = {}
    for vehicle in vehicles:
        if vehicle.driver_id is not None:
            vehicle_by_driver.setdefault(vehicle.driver_id, vehicle)

    if depot_id is not None:
        drivers = [driver for driver in drivers if driver.id in vehicle_by_driver]

    vehicle_ids = [vehicle.id for vehicle in vehicle_by_driver.values()]
    terminal_orders: list[Order] = []
    if vehicle_ids:
        order_statement = select(Order).where(
            Order.assigned_vehicle_id.in_(vehicle_ids),
            Order.status.in_(TERMINAL_ORDER_STATUSES),
            Order.status_updated_at.is_not(None),
            Order.status_updated_at >= cutoff,
            Order.status_updated_at <= reference,
        )
        if depot_id is not None:
            order_statement = order_statement.where(Order.depot_id == depot_id)
        terminal_orders = list(
            db.scalars(
                order_statement.order_by(
                    Order.assigned_vehicle_id,
                    Order.route_batch_id,
                    Order.stop_sequence,
                    Order.order_code,
                )
            ).all()
        )

    orders_by_vehicle: dict[UUID, list[Order]] = defaultdict(list)
    depot_ids: set[UUID] = set()
    for order in terminal_orders:
        if order.assigned_vehicle_id is not None:
            orders_by_vehicle[order.assigned_vehicle_id].append(order)
        if order.depot_id is not None:
            depot_ids.add(order.depot_id)
    depot_ids.update(
        vehicle.depot_id for vehicle in vehicles if vehicle.depot_id is not None
    )
    depots = list(
        db.scalars(select(Depot).where(Depot.id.in_(depot_ids))).all()
    ) if depot_ids else []
    depots_by_id = {depot.id: depot for depot in depots}
    default_depot = db.scalar(
        select(Depot).where(Depot.is_default.is_(True)).order_by(Depot.code).limit(1)
    )

    items: list[DriverPerformanceItem] = []
    for driver in drivers:
        vehicle = vehicle_by_driver.get(driver.id)
        orders = orders_by_vehicle.get(vehicle.id, []) if vehicle else []
        delivered_count = sum(
            order.status == OrderStatus.DELIVERED for order in orders
        )
        failed_count = sum(order.status == OrderStatus.FAILED for order in orders)
        total_orders = delivered_count + failed_count
        success_rate = round(
            delivered_count / total_orders * 100 if total_orders else 0,
            2,
        )
        adherence = _route_adherence_score(vehicle)
        distance = (
            _route_distance_km(
                orders,
                vehicle=vehicle,
                depots_by_id=depots_by_id,
                default_depot=default_depot,
            )
            if vehicle
            else 0
        )
        distance = round(distance, 2)
        co2_saved = calculate_route_costs(
            total_distance_km=distance,
            total_time_minutes=0,
        ).estimated_co2_savings_kg
        overall_score = round(
            min(
                100.0,
                success_rate * 0.5
                + adherence * 0.3
                + min(co2_saved, 20.0),
            ),
            2,
        )
        items.append(
            DriverPerformanceItem(
                driver_id=driver.id,
                driver_name=driver.full_name,
                email=driver.email,
                phone_number=driver.phone_number,
                license_plate=vehicle.license_plate if vehicle else None,
                vehicle_type=vehicle.vehicle_type if vehicle else None,
                total_orders_handled=total_orders,
                delivered_count=delivered_count,
                failed_count=failed_count,
                success_rate=success_rate,
                route_adherence_score=adherence,
                total_distance_km=distance,
                estimated_co2_saved_kg=co2_saved,
                overall_score=overall_score,
                tier_badge=_tier_for_score(overall_score),
                is_eco_driver=co2_saved > 5 and adherence > 90,
                rank=1,
            )
        )

    items.sort(
        key=lambda item: (
            -item.overall_score,
            -item.estimated_co2_saved_kg,
            item.driver_name.casefold(),
            str(item.driver_id),
        )
    )
    ranked_items = [
        item.model_copy(update={"rank": rank})
        for rank, item in enumerate(items, start=1)
    ]
    return DriverPerformanceResponse(
        period_days=days,
        total_co2_saved_all_kg=round(
            sum(item.estimated_co2_saved_kg for item in ranked_items),
            3,
        ),
        drivers=ranked_items,
    )
