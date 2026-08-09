from dataclasses import dataclass
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.db.models import (
    Depot as DatabaseDepot,
    Order as DatabaseOrder,
    OrderStatus,
    RouteAnalyticsSnapshot,
    User,
    Vehicle as DatabaseVehicle,
    VehicleStatus,
)
from app.services.cost_calculator import CostCalculation, calculate_route_costs
from app.services.activity_logger import log_order_activity
from app.services.driver_availability import vehicle_is_available_clause
from app.services.depot_scope import resolve_depot
from app.services.order_status import set_order_status
from app.services.notification_service import ORDER_ASSIGNED, send_order_notification
from core_engine.solver import (
    Depot as SolverDepot,
    Order as SolverOrder,
    Vehicle as SolverVehicle,
    VRPInput,
    VRPOutput,
    VRPSolver,
)


@dataclass(frozen=True)
class OptimizationRun:
    route_batch_id: UUID
    depot: DatabaseDepot
    result: VRPOutput
    cost_metrics: CostCalculation


class RouteOptimizationError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def optimize_pending_routes(
    db: Session,
    *,
    depot_id: UUID | None = None,
    actor: User | None = None,
) -> OptimizationRun:
    """Solve pending and failed orders and persist only returned assignments."""
    try:
        depot = resolve_depot(db, depot_id)
    except HTTPException as exc:
        raise RouteOptimizationError(exc.status_code, str(exc.detail)) from exc
    if depot is None:
        raise RouteOptimizationError(404, "No depot is configured")

    vehicles = list(
        db.scalars(
            select(DatabaseVehicle)
            .where(
                vehicle_is_available_clause(),
                or_(
                    DatabaseVehicle.depot_id == depot.id,
                    DatabaseVehicle.depot_id.is_(None),
                )
                if depot_id is None
                else DatabaseVehicle.depot_id == depot.id,
            )
            .order_by(DatabaseVehicle.license_plate)
            .with_for_update()
        ).all()
    )
    if not vehicles:
        raise RouteOptimizationError(409, "No available vehicle can receive a route")

    pending_orders = list(
        db.scalars(
            select(DatabaseOrder)
            .where(
                or_(
                    DatabaseOrder.depot_id == depot.id,
                    DatabaseOrder.depot_id.is_(None),
                )
                if depot_id is None
                else DatabaseOrder.depot_id == depot.id,
                DatabaseOrder.status.in_([OrderStatus.PENDING, OrderStatus.FAILED]),
            )
            .order_by(DatabaseOrder.order_code)
            .with_for_update(skip_locked=True)
        ).all()
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
            for vehicle in vehicles
        ],
        orders=[
            SolverOrder(
                id=str(order.id),
                address=order.address,
                latitude=order.latitude,
                longitude=order.longitude,
                weight_kg=order.weight_kg,
            )
            for order in pending_orders
        ],
    )
    result = VRPSolver(data=solver_input, time_limit_seconds=15).solve()

    if result.status == "ERROR":
        raise RouteOptimizationError(500, "The route solver failed")

    cost_metrics = calculate_route_costs(
        total_distance_km=result.total_distance_km,
        total_time_minutes=result.total_duration_mins,
    )
    assignments = {
        stop.order_id: (route.vehicle_id, stop.stop_sequence)
        for route in result.routes
        for stop in route.stops
    }
    vehicles_by_id = {str(vehicle.id): vehicle for vehicle in vehicles}
    route_batch_id = uuid4()
    assigned_transitions: list[tuple[DatabaseOrder, str]] = []
    for order in pending_orders:
        assignment = assignments.get(str(order.id))
        if assignment:
            old_status = order.status.value
            set_order_status(order, OrderStatus.ASSIGNED)
            order.assigned_vehicle_id = UUID(assignment[0])
            order.route_batch_id = route_batch_id
            order.stop_sequence = assignment[1]
            order.failure_reason = None

            vehicle = vehicles_by_id.get(assignment[0])
            if vehicle is not None:
                vehicle.status = VehicleStatus.ON_ROUTE
            assigned_transitions.append((order, old_status))

    db.flush()
    for order, old_status in assigned_transitions:
        log_order_activity(
            db,
            order_id=order.id,
            action="ASSIGNED",
            actor=actor,
            old_status=old_status,
            new_status=OrderStatus.ASSIGNED.value,
            detail="Batch optimization",
        )
        send_order_notification(
            db,
            order=order,
            template_code=ORDER_ASSIGNED,
            vehicle=vehicles_by_id.get(str(order.assigned_vehicle_id)),
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
    db.commit()

    return OptimizationRun(
        route_batch_id=route_batch_id,
        depot=depot,
        result=result,
        cost_metrics=cost_metrics,
    )
