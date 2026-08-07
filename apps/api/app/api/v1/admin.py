from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from app.core.security import require_roles
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
from app.schemas import (
    AvailableDriverRead,
    DriverDetailRead,
    UserRead,
    UserStatusUpdate,
    VehicleAssignmentRequest,
    VehicleTelemetryItem,
    VehicleTelemetryResponse,
)
from app.services.driver_availability import vehicle_is_available_clause
from app.services.telemetry import find_next_active_stops


router = APIRouter(prefix="/admin", tags=["admin"])
HCM_TIMEZONE = ZoneInfo("Asia/Ho_Chi_Minh")


@router.get("/telemetry", response_model=VehicleTelemetryResponse)
def list_vehicle_telemetry(
    db: Session = Depends(get_db),
    _current_user: User = Depends(
        require_roles(UserRole.ADMIN, UserRole.DISPATCHER)
    ),
) -> VehicleTelemetryResponse:
    generated_at = datetime.now(timezone.utc)
    freshness_cutoff = generated_at - timedelta(hours=1)
    vehicles = list(
        db.scalars(
            select(Vehicle)
            .where(
                or_(
                    Vehicle.status == VehicleStatus.ON_ROUTE,
                    Vehicle.last_gps_ping_at >= freshness_cutoff,
                )
            )
            .order_by(Vehicle.license_plate)
        ).all()
    )
    next_stops = find_next_active_stops(db, (vehicle.id for vehicle in vehicles))
    items: list[VehicleTelemetryItem] = []
    for vehicle in vehicles:
        next_stop = next_stops.get(vehicle.id)
        items.append(
            VehicleTelemetryItem(
                vehicle_id=vehicle.id,
                license_plate=vehicle.license_plate,
                driver_name=vehicle.driver_name,
                status=vehicle.status,
                current_latitude=vehicle.current_latitude,
                current_longitude=vehicle.current_longitude,
                speed_kmh=vehicle.current_speed_kmh,
                last_gps_ping_at=vehicle.last_gps_ping_at,
                route_deviation_status=vehicle.route_deviation_status,
                next_stop_address=next_stop.address if next_stop else None,
                next_stop_sequence=next_stop.stop_sequence if next_stop else None,
            )
        )
    return VehicleTelemetryResponse(generated_at=generated_at, vehicles=items)


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


@router.get("/drivers", response_model=list[DriverDetailRead])
def list_drivers(
    search: Annotated[str | None, Query(max_length=100)] = None,
    account_status: Annotated[
        UserStatus | None,
        Query(alias="status"),
    ] = None,
    has_vehicle: bool | None = None,
    db: Session = Depends(get_db),
    _current_user: User = Depends(
        require_roles(UserRole.ADMIN, UserRole.DISPATCHER)
    ),
) -> list[DriverDetailRead]:
    """Return one operational summary row per driver."""
    local_now = datetime.now(HCM_TIMEZONE)
    today_start = local_now.replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    ).astimezone(timezone.utc)
    tomorrow_start = (local_now + timedelta(days=1)).replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    ).astimezone(timezone.utc)

    order_counts = (
        select(
            Order.assigned_vehicle_id.label("vehicle_id"),
            func.count(
                case(
                    (
                        Order.status.in_(
                            [OrderStatus.ASSIGNED, OrderStatus.DELIVERING]
                        ),
                        1,
                    )
                )
            ).label("active_orders_count"),
            func.count(
                case(
                    (
                        (
                            (Order.status == OrderStatus.DELIVERED)
                            & (Order.status_updated_at >= today_start)
                            & (Order.status_updated_at < tomorrow_start)
                        ),
                        1,
                    )
                )
            ).label("delivered_today_count"),
            func.count(
                case(
                    (
                        (
                            (Order.status == OrderStatus.FAILED)
                            & (Order.status_updated_at >= today_start)
                            & (Order.status_updated_at < tomorrow_start)
                        ),
                        1,
                    )
                )
            ).label("failed_today_count"),
        )
        .where(Order.assigned_vehicle_id.is_not(None))
        .group_by(Order.assigned_vehicle_id)
        .subquery()
    )
    statement = (
        select(
            User,
            Vehicle,
            func.coalesce(order_counts.c.active_orders_count, 0),
            func.coalesce(order_counts.c.delivered_today_count, 0),
            func.coalesce(order_counts.c.failed_today_count, 0),
        )
        .outerjoin(Vehicle, Vehicle.driver_id == User.id)
        .outerjoin(order_counts, order_counts.c.vehicle_id == Vehicle.id)
        .where(User.role == UserRole.DRIVER)
        .order_by(User.full_name, User.email)
    )

    normalized_search = search.strip() if search else ""
    if normalized_search:
        lowered_search = normalized_search.lower()
        statement = statement.where(
            func.lower(User.full_name).contains(lowered_search, autoescape=True)
            | func.lower(User.email).contains(lowered_search, autoescape=True)
        )
    if account_status is not None:
        statement = statement.where(User.status == account_status)
    if has_vehicle is True:
        statement = statement.where(Vehicle.id.is_not(None))
    elif has_vehicle is False:
        statement = statement.where(Vehicle.id.is_(None))

    return [
        DriverDetailRead(
            id=driver.id,
            full_name=driver.full_name,
            email=driver.email,
            phone_number=driver.phone_number,
            status=driver.status,
            created_at=driver.created_at,
            vehicle_id=vehicle.id if vehicle else None,
            license_plate=vehicle.license_plate if vehicle else None,
            vehicle_type=vehicle.vehicle_type if vehicle else None,
            vehicle_status=vehicle.status if vehicle else None,
            capacity_kg=vehicle.capacity_kg if vehicle else None,
            service_area=vehicle.service_area if vehicle else None,
            active_orders_count=int(active_count),
            delivered_today_count=int(delivered_count),
            failed_today_count=int(failed_count),
        )
        for (
            driver,
            vehicle,
            active_count,
            delivered_count,
            failed_count,
        ) in db.execute(statement).all()
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
