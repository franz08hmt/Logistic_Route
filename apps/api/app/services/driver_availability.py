from uuid import UUID

from sqlalchemy import exists, func, or_, select
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from app.db.models import Order, OrderStatus, Vehicle, VehicleStatus


ACTIVE_ROUTE_STATUSES = (
    OrderStatus.PENDING,
    OrderStatus.ASSIGNED,
    OrderStatus.DELIVERING,
)


def vehicle_is_available_clause() -> ColumnElement[bool]:
    """Treat an IDLE vehicle or a stale ON_ROUTE vehicle with no active stops as ready."""
    active_order_exists = exists(
        select(Order.id).where(
            Order.assigned_vehicle_id == Vehicle.id,
            Order.status.in_(ACTIVE_ROUTE_STATUSES),
        )
    )
    return or_(Vehicle.status == VehicleStatus.IDLE, ~active_order_exists)


def count_active_vehicle_orders(db: Session, vehicle_id: UUID) -> int:
    return int(
        db.scalar(
            select(func.count(Order.id)).where(
                Order.assigned_vehicle_id == vehicle_id,
                Order.status.in_(ACTIVE_ROUTE_STATUSES),
            )
        )
        or 0
    )


def reconcile_vehicle_availability(db: Session, vehicle: Vehicle) -> None:
    """Restore IDLE only after every assigned stop has reached a terminal state."""
    vehicle.status = (
        VehicleStatus.IDLE
        if count_active_vehicle_orders(db, vehicle.id) == 0
        else VehicleStatus.ON_ROUTE
    )
