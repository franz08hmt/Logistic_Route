from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import Order, OrderStatus, User, UserRole
from app.db.session import get_db
from app.core.security import get_current_user, require_roles
from app.schemas import OrderCreate, OrderRead, OrderStatusUpdate


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

    order = Order(**payload.model_dump())
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
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = payload.status
    failure_reason = payload.failure_reason.strip() if payload.failure_reason else None
    order.failure_reason = (
        failure_reason if payload.status is OrderStatus.FAILED else None
    )
    if payload.status is OrderStatus.PENDING:
        order.assigned_vehicle_id = None
        order.stop_sequence = None

    db.commit()
    db.refresh(order)
    return order
