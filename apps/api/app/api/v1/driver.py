from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.models import Depot, Order, OrderStatus, User, UserRole, Vehicle
from app.db.session import get_db
from app.schemas import (
    DepotRead,
    DriverOrderStatusUpdate,
    DriverRouteRead,
    DriverStopRead,
    DriverVehicleRead,
)


router = APIRouter(prefix="/driver", tags=["driver"])


def _driver_vehicle(db: Session, current_user: User) -> Vehicle:
    vehicle = db.scalar(
        select(Vehicle)
        .where(Vehicle.driver_id == current_user.id)
        .order_by(Vehicle.license_plate)
        .limit(1)
    )
    if vehicle is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No vehicle is assigned to this driver",
        )
    return vehicle


@router.get("/route", response_model=DriverRouteRead)
def get_driver_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DRIVER)),
) -> DriverRouteRead:
    vehicle = _driver_vehicle(db, current_user)
    depot = db.scalar(select(Depot).order_by(Depot.name, Depot.id).limit(1))
    if depot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No depot is configured",
        )

    orders = list(
        db.scalars(
            select(Order)
            .where(Order.assigned_vehicle_id == vehicle.id)
            .order_by(Order.stop_sequence.nulls_last(), Order.order_code)
        ).all()
    )

    return DriverRouteRead(
        vehicle=DriverVehicleRead.model_validate(vehicle),
        depot=DepotRead.model_validate(depot),
        total_orders=len(orders),
        completed_orders=sum(
            order.status is OrderStatus.DELIVERED for order in orders
        ),
        stops=[DriverStopRead.model_validate(order) for order in orders],
    )


@router.patch("/orders/{order_id}/status", response_model=DriverStopRead)
def update_driver_order_status(
    order_id: UUID,
    payload: DriverOrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DRIVER)),
) -> Order:
    vehicle = _driver_vehicle(db, current_user)
    order = db.scalar(
        select(Order).where(
            Order.id == order_id,
            Order.assigned_vehicle_id == vehicle.id,
        )
    )
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order is not assigned to this driver",
        )

    terminal_statuses = {OrderStatus.DELIVERED, OrderStatus.FAILED}
    requested_status = OrderStatus(payload.status.value)
    if order.status in terminal_statuses and order.status is not requested_status:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A completed delivery cannot be moved back to another status",
        )

        order.status = requested_status
        order.delivery_note = payload.delivery_note
        order.failure_reason = (
            payload.delivery_note if requested_status is OrderStatus.FAILED else None
        )
        order.pod_url = str(payload.pod_url) if payload.pod_url else None
    db.commit()
    db.refresh(order)
    return order
