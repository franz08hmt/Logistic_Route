from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_roles
from app.db.models import Depot, Order, OrderStatus, User, UserRole, Vehicle
from app.db.session import get_db
from app.schemas import DepotCreate, DepotRead, DepotUpdate


router = APIRouter(prefix="/depots", tags=["depots"])


def _depot_summary_statement():
    vehicle_totals = (
        select(
            Vehicle.depot_id.label("depot_id"),
            func.count(Vehicle.id).label("vehicle_count"),
            func.coalesce(func.sum(Vehicle.capacity_kg), 0).label(
                "total_vehicle_capacity_kg"
            ),
        )
        .where(Vehicle.depot_id.is_not(None))
        .group_by(Vehicle.depot_id)
        .subquery()
    )
    order_totals = (
        select(
            Order.depot_id.label("depot_id"),
            func.count(Order.id).label("active_orders_count"),
        )
        .where(
            Order.depot_id.is_not(None),
            Order.status.in_(
                [OrderStatus.PENDING, OrderStatus.ASSIGNED, OrderStatus.DELIVERING]
            ),
        )
        .group_by(Order.depot_id)
        .subquery()
    )
    return (
        select(
            Depot,
            func.coalesce(vehicle_totals.c.vehicle_count, 0),
            func.coalesce(order_totals.c.active_orders_count, 0),
            func.coalesce(vehicle_totals.c.total_vehicle_capacity_kg, 0),
        )
        .outerjoin(vehicle_totals, vehicle_totals.c.depot_id == Depot.id)
        .outerjoin(order_totals, order_totals.c.depot_id == Depot.id)
        .order_by(Depot.is_default.desc(), Depot.code)
    )


def _to_read(row: tuple[Depot, int, int, float]) -> DepotRead:
    depot, vehicle_count, active_orders_count, total_capacity = row
    return DepotRead(
        id=depot.id,
        code=depot.code,
        name=depot.name,
        city=depot.city,
        address=depot.address,
        latitude=depot.latitude,
        longitude=depot.longitude,
        is_default=depot.is_default,
        vehicle_count=int(vehicle_count),
        active_orders_count=int(active_orders_count),
        total_vehicle_capacity_kg=float(total_capacity),
    )


@router.get("", response_model=list[DepotRead])
def list_depots(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> list[DepotRead]:
    return [_to_read(row) for row in db.execute(_depot_summary_statement()).all()]


@router.post("", response_model=DepotRead, status_code=status.HTTP_201_CREATED)
def create_depot(
    payload: DepotCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> DepotRead:
    if db.scalar(select(Depot.id).where(Depot.code == payload.code)) is not None:
        raise HTTPException(status_code=409, detail="Depot code already exists")

    is_first = db.scalar(select(func.count(Depot.id))) == 0
    if payload.is_default or is_first:
        db.execute(update(Depot).values(is_default=False))
    depot = Depot(**payload.model_dump(exclude={"is_default"}))
    depot.is_default = payload.is_default or is_first
    db.add(depot)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Depot code already exists") from exc

    row = db.execute(_depot_summary_statement().where(Depot.id == depot.id)).one()
    return _to_read(row)


@router.patch("/{depot_id}", response_model=DepotRead)
def update_depot(
    depot_id: UUID,
    payload: DepotUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> DepotRead:
    depot = db.get(Depot, depot_id)
    if depot is None:
        raise HTTPException(status_code=404, detail="Depot not found")

    changes = payload.model_dump(exclude_unset=True)
    next_code = changes.get("code")
    if next_code is not None:
        duplicate = db.scalar(
            select(Depot.id).where(Depot.code == next_code, Depot.id != depot.id)
        )
        if duplicate is not None:
            raise HTTPException(status_code=409, detail="Depot code already exists")

    requested_default = changes.pop("is_default", None)
    if requested_default is True:
        db.execute(update(Depot).where(Depot.id != depot.id).values(is_default=False))
        depot.is_default = True
    elif requested_default is False and depot.is_default:
        other_default = db.scalar(
            select(Depot.id).where(Depot.id != depot.id, Depot.is_default.is_(True))
        )
        if other_default is None:
            raise HTTPException(status_code=409, detail="At least one depot must be default")
        depot.is_default = False

    for field, value in changes.items():
        setattr(depot, field, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Depot code already exists") from exc

    row = db.execute(_depot_summary_statement().where(Depot.id == depot.id)).one()
    return _to_read(row)
