from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import (
    Order,
    OrderStatus,
    User,
    UserRole,
    UserStatus,
    Vehicle,
    VehicleStatus,
)
from app.db.session import get_db
from app.core.security import get_current_user, require_roles
from app.schemas import OrderCreate, OrderRead, OrderStatusUpdate
from app.services.driver_availability import (
    reconcile_vehicle_availability,
    vehicle_is_available_clause,
)
from app.services.region_matcher import regions_match


router = APIRouter(prefix="/orders", tags=["orders"])


@router.get("", response_model=list[OrderRead])
def list_orders(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> list[Order]:
    return list(db.scalars(select(Order).order_by(Order.order_code)).all())


@router.post("", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
def create_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DISPATCHER)),
) -> Order:
    existing = db.scalar(select(Order).where(Order.order_code == payload.order_code))
    if existing:
        raise HTTPException(status_code=409, detail="order_code already exists")

    order_data = payload.model_dump(
        exclude={"assigned_driver_id", "force_region_mismatch"}
    )
    assigned_driver_id = payload.assigned_driver_id
    if assigned_driver_id is not None:
        row = db.execute(
            select(User, Vehicle)
            .join(Vehicle, Vehicle.driver_id == User.id)
            .where(
                User.id == assigned_driver_id,
                User.role == UserRole.DRIVER,
                User.status == UserStatus.ACTIVE,
                vehicle_is_available_clause(),
            )
            .with_for_update()
            .limit(1)
        ).first()
        if row is None:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "DRIVER_NOT_READY",
                    "message": "Selected driver is not ready for assignment",
                },
            )
        driver, vehicle = row
        if payload.weight_kg > vehicle.capacity_kg:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "VEHICLE_CAPACITY_EXCEEDED",
                    "message": "Order weight exceeds the selected vehicle capacity",
                },
            )

        # This server-side check mirrors the UI warning. It prevents a crafted
        # client from silently bypassing the dispatcher confirmation.
        if (
            payload.delivery_region
            and vehicle.service_area
            and not regions_match(payload.delivery_region, vehicle.service_area)
            and not payload.force_region_mismatch
        ):
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "REGION_MISMATCH",
                    "message": (
                        f"Driver {driver.full_name} serves {vehicle.service_area}, "
                        f"but this delivery is in {payload.delivery_region}"
                    ),
                    "driver_name": driver.full_name,
                    "driver_region": vehicle.service_area,
                    "delivery_region": payload.delivery_region,
                },
            )

        last_sequence = db.scalar(
            select(func.max(Order.stop_sequence)).where(
                Order.assigned_vehicle_id == vehicle.id
            )
        )
        order_data.update(
            assigned_vehicle_id=vehicle.id,
            stop_sequence=(last_sequence or 0) + 1,
            status=OrderStatus.ASSIGNED,
        )
        vehicle.status = VehicleStatus.ON_ROUTE

    order = Order(**order_data)
    db.add(order)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="order_code already exists") from exc
    db.refresh(order)
    return order


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(
    order_id: UUID,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DISPATCHER)),
) -> Response:
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    db.delete(order)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/{order_id}/status", response_model=OrderRead)
def update_order_status(
    order_id: UUID,
    payload: OrderStatusUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DISPATCHER)),
) -> Order:
    assignment = db.execute(
        select(Order.assigned_vehicle_id).where(Order.id == order_id)
    ).first()
    if assignment is None:
        raise HTTPException(status_code=404, detail="Order not found")
    assigned_vehicle_id = assignment[0]
    vehicle = (
        db.scalar(
            select(Vehicle)
            .where(Vehicle.id == assigned_vehicle_id)
            .with_for_update()
        )
        if assigned_vehicle_id is not None
        else None
    )
    order = db.scalar(
        select(Order).where(Order.id == order_id).with_for_update()
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.assigned_vehicle_id != assigned_vehicle_id:
        raise HTTPException(
            status_code=409,
            detail="Order assignment changed; retry the status update",
        )

    order.status = payload.status
    failure_reason = payload.failure_reason.strip() if payload.failure_reason else None
    order.failure_reason = (
        failure_reason if payload.status is OrderStatus.FAILED else None
    )
    if payload.status is OrderStatus.PENDING:
        order.assigned_vehicle_id = None
        order.stop_sequence = None

    db.flush()
    if vehicle is not None:
        # Dispatcher overrides share the same lifecycle rule as driver updates:
        # the locked vehicle returns to IDLE only when no active stop remains.
        reconcile_vehicle_availability(db, vehicle)
    db.commit()
    db.refresh(order)
    return order
