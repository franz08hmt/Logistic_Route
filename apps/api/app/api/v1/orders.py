import logging
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
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
from app.schemas import (
    OrderCreate,
    OrderDispatchRequest,
    OrderRead,
    OrderStatusUpdate,
)
from app.services.driver_availability import (
    reconcile_vehicle_availability,
    vehicle_is_available_clause,
)
from app.services.order_status import set_order_status
from app.services.region_matcher import regions_match


router = APIRouter(prefix="/orders", tags=["orders"])
logger = logging.getLogger(__name__)


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

    # Creation is deliberately side-effect free for dispatch state. Assignment
    # only happens through POST /orders/{id}/dispatch.
    order = Order(
        **payload.model_dump(exclude={"status"}),
        status=OrderStatus.PENDING,
        assigned_vehicle_id=None,
        route_batch_id=None,
        stop_sequence=None,
    )
    db.add(order)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="order_code already exists") from exc
    db.refresh(order)
    logger.info("order_created order_id=%s status=PENDING", order.id)
    return order


@router.post("/{order_id}/dispatch", response_model=OrderRead)
def dispatch_order(
    order_id: UUID,
    payload: OrderDispatchRequest,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DISPATCHER)),
) -> Order:
    """Explicitly assign one pending/failed order to a ready driver's vehicle."""
    order = db.scalar(
        select(Order).where(Order.id == order_id).with_for_update()
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status not in {OrderStatus.PENDING, OrderStatus.FAILED}:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "ORDER_NOT_DISPATCHABLE",
                "message": "Only PENDING or FAILED orders can be dispatched",
            },
        )

    row = db.execute(
        select(User, Vehicle)
        .join(Vehicle, Vehicle.driver_id == User.id)
        .where(
            User.id == payload.driver_id,
            User.role == UserRole.DRIVER,
            User.status == UserStatus.ACTIVE,
            vehicle_is_available_clause(),
        )
        .with_for_update()
        .limit(1)
    ).first()
    if row is None:
        logger.warning(
            "order_dispatch_rejected order_id=%s driver_id=%s reason=not_ready",
            order.id,
            payload.driver_id,
        )
        raise HTTPException(
            status_code=409,
            detail={
                "code": "DRIVER_NOT_READY",
                "message": "Selected driver is not ready for assignment",
            },
        )

    driver, vehicle = row
    if order.weight_kg > vehicle.capacity_kg:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "VEHICLE_CAPACITY_EXCEEDED",
                "message": "Order weight exceeds the selected vehicle capacity",
            },
        )

    if (
        order.delivery_region
        and vehicle.service_area
        and not regions_match(order.delivery_region, vehicle.service_area)
        and not payload.force_region_mismatch
    ):
        raise HTTPException(
            status_code=409,
            detail={
                "code": "REGION_MISMATCH",
                "message": (
                    f"Driver {driver.full_name} serves {vehicle.service_area}, "
                    f"but this delivery is in {order.delivery_region}"
                ),
                "driver_name": driver.full_name,
                "driver_region": vehicle.service_area,
                "delivery_region": order.delivery_region,
            },
        )

    order.assigned_vehicle_id = vehicle.id
    order.route_batch_id = uuid4()
    order.stop_sequence = 1
    set_order_status(order, OrderStatus.ASSIGNED)
    order.failure_reason = None
    vehicle.status = VehicleStatus.ON_ROUTE
    try:
        db.commit()
    except Exception:
        db.rollback()
        logger.exception(
            "order_dispatch_failed order_id=%s driver_id=%s",
            order.id,
            payload.driver_id,
        )
        raise
    db.refresh(order)
    logger.info(
        "order_dispatched order_id=%s driver_id=%s vehicle_id=%s batch_id=%s",
        order.id,
        driver.id,
        vehicle.id,
        order.route_batch_id,
    )
    return order


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(
    order_id: UUID,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DISPATCHER)),
) -> Response:
    order = db.scalar(select(Order).where(Order.id == order_id).with_for_update())
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    vehicle = (
        db.scalar(
            select(Vehicle)
            .where(Vehicle.id == order.assigned_vehicle_id)
            .with_for_update()
        )
        if order.assigned_vehicle_id is not None
        else None
    )
    db.delete(order)
    db.flush()
    if vehicle is not None:
        reconcile_vehicle_availability(db, vehicle)
    db.commit()
    logger.info("order_deleted order_id=%s", order_id)
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

    set_order_status(order, payload.status)
    failure_reason = payload.failure_reason.strip() if payload.failure_reason else None
    order.failure_reason = (
        failure_reason if payload.status is OrderStatus.FAILED else None
    )
    if payload.status is OrderStatus.PENDING:
        order.assigned_vehicle_id = None
        order.route_batch_id = None
        order.stop_sequence = None

    db.flush()
    if vehicle is not None:
        # Dispatcher overrides share the same lifecycle rule as driver updates:
        # the locked vehicle returns to IDLE only when no active stop remains.
        reconcile_vehicle_availability(db, vehicle)
    db.commit()
    db.refresh(order)
    return order
