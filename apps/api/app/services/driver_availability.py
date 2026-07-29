from uuid import UUID

from sqlalchemy import exists, func, select
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from app.db.models import Order, OrderStatus, Vehicle, VehicleStatus


ACTIVE_ROUTE_STATUSES = (
    OrderStatus.PENDING,
    OrderStatus.ASSIGNED,
    OrderStatus.DELIVERING,
)


def vehicle_is_available_clause() -> ColumnElement[bool]:
    """A vehicle is ready only when the database has no active assigned stops."""
    active_order_exists = exists(
        select(Order.id).where(
            Order.assigned_vehicle_id == Vehicle.id,
            Order.status.in_(ACTIVE_ROUTE_STATUSES),
        )
    )
    return ~active_order_exists


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
