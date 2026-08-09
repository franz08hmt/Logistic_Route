from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import Vehicle
from app.db.models import User, UserRole
from app.core.security import get_current_user, require_roles
from app.db.session import get_db
from app.schemas import VehicleCreate, VehicleRead
from app.services.depot_scope import resolve_depot


router = APIRouter(prefix="/vehicles", tags=["vehicles"])


@router.get("", response_model=list[VehicleRead])
def list_vehicles(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    depot_id: UUID | None = None,
) -> list[Vehicle]:
    depot = resolve_depot(db, depot_id)
    statement = select(Vehicle).order_by(Vehicle.license_plate)
    if depot is not None:
        statement = statement.where(
            or_(Vehicle.depot_id == depot.id, Vehicle.depot_id.is_(None))
            if depot_id is None
            else Vehicle.depot_id == depot.id
        )
    return list(db.scalars(statement).all())


@router.post("", response_model=VehicleRead, status_code=status.HTTP_201_CREATED)
def create_vehicle(
    payload: VehicleCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DISPATCHER)),
) -> Vehicle:
    existing = db.scalar(
        select(Vehicle).where(Vehicle.license_plate == payload.license_plate)
    )
    if existing:
        raise HTTPException(status_code=409, detail="license_plate already exists")

    depot = resolve_depot(db, payload.depot_id)
    vehicle = Vehicle(
        **payload.model_dump(exclude={"depot_id"}),
        depot_id=depot.id if depot is not None else None,
    )
    db.add(vehicle)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="license_plate already exists") from exc
    db.refresh(vehicle)
    return vehicle


@router.delete("/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vehicle(
    vehicle_id: UUID,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DISPATCHER)),
) -> Response:
    vehicle = db.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    db.delete(vehicle)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
