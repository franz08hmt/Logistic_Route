"""Transactional optimization and assignment for an explicitly selected route."""

from dataclasses import dataclass
import logging
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    Depot as DatabaseDepot,
    Order as DatabaseOrder,
    OrderStatus,
    RouteAnalyticsSnapshot,
    User,
    UserRole,
    UserStatus,
    Vehicle as DatabaseVehicle,
    VehicleStatus,
)
from app.services.cost_calculator import CostCalculation, calculate_route_costs
from app.services.activity_logger import log_order_activity
from app.services.driver_availability import vehicle_is_available_clause
from app.services.depot_scope import resolve_depot
from app.services.order_status import set_order_status
from app.services.notification_service import ORDER_ASSIGNED, send_order_notification
from app.services.region_matcher import regions_match
from core_engine.solver import (
    Depot as SolverDepot,
    Order as SolverOrder,
    Vehicle as SolverVehicle,
    VRPInput,
    VRPOutput,
    VRPSolver,
)


logger = logging.getLogger(__name__)


class MultiStopDispatchError(Exception):
    def __init__(self, status_code: int, detail: str | dict[str, object]) -> None:
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail


@dataclass(frozen=True)
class MultiStopDispatchRun:
    route_batch_id: UUID
    depot: DatabaseDepot
    driver: User
    vehicle: DatabaseVehicle
    orders_by_id: dict[UUID, DatabaseOrder]
    result: VRPOutput
    cost_metrics: CostCalculation


def _abort(
    db: Session,
    status_code: int,
    detail: str | dict[str, object],
) -> None:
    db.rollback()
    raise MultiStopDispatchError(status_code, detail)


def dispatch_optimized_route(
    db: Session,
    *,
    order_ids: list[UUID],
    driver_id: UUID,
    force_region_mismatch: bool = False,
    actor: User | None = None,
) -> MultiStopDispatchRun:
    """Optimize selected pending stops and persist one atomic dispatch batch."""
    # Lock the vehicle before orders, matching the global optimizer's lock
    # order so both dispatch paths cannot deadlock each other.
    row = db.execute(
        select(User, DatabaseVehicle)
        .join(DatabaseVehicle, DatabaseVehicle.driver_id == User.id)
        .where(
            User.id == driver_id,
            User.role == UserRole.DRIVER,
            User.status == UserStatus.ACTIVE,
            vehicle_is_available_clause(),
        )
        .with_for_update()
        .limit(1)
    ).first()
    if row is None:
        _abort(
            db,
            409,
            {
                "code": "DRIVER_NOT_READY",
                "message": "Selected driver is not ready for assignment",
            },
        )
    driver, vehicle = row
    depot = resolve_depot(db, vehicle.depot_id)
    if depot is None:
        _abort(db, 404, "No depot is configured")
    if vehicle.depot_id is None:
        vehicle.depot_id = depot.id

    orders = list(
        db.scalars(
            select(DatabaseOrder)
            .where(DatabaseOrder.id.in_(order_ids))
            .order_by(DatabaseOrder.order_code)
            .with_for_update()
        ).all()
    )
    if len(orders) != len(order_ids):
        _abort(db, 404, "One or more selected orders were not found")
    cross_depot = [
        order.order_code
        for order in orders
        if order.depot_id is not None and order.depot_id != depot.id
    ]
    if cross_depot:
        _abort(
            db,
            409,
            {
                "code": "DEPOT_MISMATCH",
                "message": "Selected orders and vehicle must belong to the same depot",
                "order_codes": cross_depot,
            },
        )
    for order in orders:
        if order.depot_id is None:
            order.depot_id = depot.id
    non_pending = [
        order.order_code
        for order in orders
        if order.status is not OrderStatus.PENDING
    ]
    if non_pending:
        _abort(
            db,
            409,
            {
                "code": "ORDERS_NOT_PENDING",
                "message": "All selected orders must still be PENDING",
                "order_codes": non_pending,
            },
        )

    total_weight_kg = sum(order.weight_kg for order in orders)
    if total_weight_kg > vehicle.capacity_kg:
        _abort(
            db,
            409,
            {
                "code": "VEHICLE_CAPACITY_EXCEEDED",
                "message": "Selected orders exceed the vehicle capacity",
                "total_weight_kg": total_weight_kg,
                "capacity_kg": vehicle.capacity_kg,
            },
        )

    mismatched_regions = sorted(
        {
            order.delivery_region
            for order in orders
            if order.delivery_region
            and vehicle.service_area
            and not regions_match(order.delivery_region, vehicle.service_area)
        }
    )
    if mismatched_regions and not force_region_mismatch:
        _abort(
            db,
            409,
            {
                "code": "REGION_MISMATCH",
                "message": (
                    f"Driver {driver.full_name} serves {vehicle.service_area}, "
                    "but one or more selected orders are outside that area"
                ),
                "driver_name": driver.full_name,
                "driver_region": vehicle.service_area,
                "delivery_regions": mismatched_regions,
            },
        )

    solver_input = VRPInput(
        depot=SolverDepot(
            id=str(depot.id),
            name=depot.name,
            latitude=depot.latitude,
            longitude=depot.longitude,
        ),
        vehicles=[
            SolverVehicle(
                id=str(vehicle.id),
                license_plate=vehicle.license_plate,
                capacity_kg=vehicle.capacity_kg,
            )
        ],
        orders=[
            SolverOrder(
                id=str(order.id),
                address=order.address,
                latitude=order.latitude,
                longitude=order.longitude,
                weight_kg=order.weight_kg,
            )
            for order in orders
        ],
    )
    try:
        result = VRPSolver(data=solver_input, time_limit_seconds=15).solve()
    except Exception:
        db.rollback()
        logger.exception(
            "multi_stop_solver_failed driver_id=%s selected_count=%s",
            driver_id,
            len(order_ids),
        )
        raise

    assigned_stop_ids = {
        UUID(stop.order_id)
        for route in result.routes
        for stop in route.stops
    }
    if (
        result.status in {"ERROR", "INFEASIBLE"}
        or result.unassigned_orders
        or assigned_stop_ids != set(order_ids)
        or len(result.routes) != 1
    ):
        _abort(
            db,
            409,
            {
                "code": "ROUTE_NOT_FEASIBLE",
                "message": "The selected orders cannot form one feasible route",
            },
        )

    route_batch_id = uuid4()
    orders_by_id = {order.id: order for order in orders}
    for stop in result.routes[0].stops:
        order = orders_by_id[UUID(stop.order_id)]
        set_order_status(order, OrderStatus.ASSIGNED)
        order.assigned_vehicle_id = vehicle.id
        order.route_batch_id = route_batch_id
        order.stop_sequence = stop.stop_sequence
        order.failure_reason = None
    vehicle.status = VehicleStatus.ON_ROUTE

    db.flush()
    for order in orders:
        log_order_activity(
            db,
            order_id=order.id,
            action="ASSIGNED",
            actor=actor,
            old_status=OrderStatus.PENDING.value,
            new_status=OrderStatus.ASSIGNED.value,
            detail="Batch optimization",
        )
        send_order_notification(
            db,
            order=order,
            template_code=ORDER_ASSIGNED,
            vehicle=vehicle,
            driver=driver,
        )

    cost_metrics = calculate_route_costs(
        total_distance_km=result.total_distance_km,
        total_time_minutes=result.total_duration_mins,
    )
    db.add(
        RouteAnalyticsSnapshot(
            depot_id=depot.id,
            total_distance_km=result.total_distance_km,
            total_duration_mins=result.total_duration_mins,
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
        logger.exception(
            "multi_stop_dispatch_commit_failed driver_id=%s selected_count=%s",
            driver_id,
            len(order_ids),
        )
        raise

    logger.info(
        "multi_stop_dispatch_completed batch_id=%s driver_id=%s vehicle_id=%s stop_count=%s",
        route_batch_id,
        driver.id,
        vehicle.id,
        len(orders),
    )
    return MultiStopDispatchRun(
        route_batch_id=route_batch_id,
        depot=depot,
        driver=driver,
        vehicle=vehicle,
        orders_by_id=orders_by_id,
        result=result,
        cost_metrics=cost_metrics,
    )
