from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.models import User, UserRole, UserStatus, Vehicle, VehicleStatus
from app.db.session import get_db
from app.schemas import (
    AvailableDriverRead,
    UserRead,
    UserStatusUpdate,
    VehicleAssignmentRequest,
)
from app.services.driver_availability import vehicle_is_available_clause


router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[UserRead])
def list_users(
    db: Session = Depends(get_db),
    _current_user: User = Depends(
        require_roles(UserRole.ADMIN, UserRole.DISPATCHER)
    ),
) -> list[User]:
    return list(db.scalars(select(User).order_by(User.email)).all())


@router.get("/drivers/available", response_model=list[AvailableDriverRead])
def list_available_drivers(
    db: Session = Depends(get_db),
    _current_user: User = Depends(
        require_roles(UserRole.ADMIN, UserRole.DISPATCHER)
    ),
) -> list[AvailableDriverRead]:
    rows = db.execute(
        select(User, Vehicle)
        .join(Vehicle, Vehicle.driver_id == User.id)
        .where(
            User.role == UserRole.DRIVER,
            User.status == UserStatus.ACTIVE,
            vehicle_is_available_clause(),
        )
        .order_by(User.full_name, Vehicle.license_plate)
    ).all()
    return [
        AvailableDriverRead(
            driver_id=driver.id,
            full_name=driver.full_name,
            phone_number=driver.phone_number,
            vehicle_id=vehicle.id,
            license_plate=vehicle.license_plate,
            vehicle_type=vehicle.vehicle_type,
            capacity_kg=vehicle.capacity_kg,
            service_area=vehicle.service_area,
        )
        for driver, vehicle in rows
    ]


@router.patch("/users/{user_id}/status", response_model=UserRead)
def update_user_status(
    user_id: UUID,
    payload: UserStatusUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user.status = payload.status
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}/vehicle", response_model=UserRead)
def assign_vehicle(
    user_id: UUID,
    payload: VehicleAssignmentRequest,
    db: Session = Depends(get_db),
    _current_user: User = Depends(
        require_roles(UserRole.ADMIN, UserRole.DISPATCHER)
    ),
) -> User:
    driver = db.get(User, user_id)
    if driver is None:
        raise HTTPException(status_code=404, detail="Driver not found")
    if driver.role is not UserRole.DRIVER:
        raise HTTPException(status_code=422, detail="Vehicle can only be assigned to a driver")
    if driver.status is not UserStatus.ACTIVE:
        raise HTTPException(status_code=409, detail="Driver account must be active")

    vehicle = db.get(Vehicle, payload.vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    if vehicle.driver_id not in {None, driver.id} or (
        vehicle.driver_id is None and vehicle.status is not VehicleStatus.IDLE
    ):
        raise HTTPException(status_code=409, detail="Vehicle is not available")

    previous_vehicle = db.scalar(
        select(Vehicle).where(
            Vehicle.driver_id == driver.id,
            Vehicle.id != vehicle.id,
        )
    )
    if previous_vehicle is not None:
        previous_vehicle.driver_id = None
        previous_vehicle.driver_name = None
        previous_vehicle.status = VehicleStatus.IDLE
        previous_vehicle.service_area = None
        previous_vehicle.assignment_note = None

    vehicle.driver_id = driver.id
    vehicle.driver_name = driver.full_name
    vehicle.status = VehicleStatus.IDLE
    vehicle.service_area = payload.service_area
    vehicle.assignment_note = payload.assignment_note
    db.commit()
    db.refresh(driver)
    return driver
