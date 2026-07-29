from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.db.models import (
    Depot,
    Order,
    OrderStatus,
    User,
    UserRole,
    UserStatus,
    Vehicle,
    VehicleStatus,
)
from app.db.session import get_db
from app.schemas import DepotRead, SeedResponse, SeedUsersResponse, UserRead


router = APIRouter(tags=["seed"])

SEED_DEPOT = {
    "name": "LogiRoute Depot Quan 12",
    "address": "12 Quoc Lo 1A, Quan 12, Ho Chi Minh City",
    "latitude": 10.8632,
    "longitude": 106.6535,
}

SEED_VEHICLES = [
    {
        "license_plate": "51D-12001",
        "capacity_kg": 1200,
        "driver_name": "Nguyen Van Minh",
        "status": VehicleStatus.ON_ROUTE,
    },
    {
        "license_plate": "51D-12002",
        "capacity_kg": 800,
        "driver_name": "Tran Thi Lan",
        "status": VehicleStatus.IDLE,
    },
]

SEED_ORDERS = [
    {
        "order_code": "LR-HCM-001",
        "customer_name": "Pham Gia Dung",
        "customer_phone": "0901000001",
        "address": "Ben Nghe, Quan 1, Ho Chi Minh City",
        "latitude": 10.7769,
        "longitude": 106.7009,
        "weight_kg": 12.5,
        "status": OrderStatus.ASSIGNED,
    },
    {
        "order_code": "LR-HCM-002",
        "customer_name": "Le Minh Anh",
        "customer_phone": "0901000002",
        "address": "Ward 5, Go Vap, Ho Chi Minh City",
        "latitude": 10.8387,
        "longitude": 106.6653,
        "weight_kg": 6.0,
        "status": OrderStatus.PENDING,
    },
    {
        "order_code": "LR-HCM-003",
        "customer_name": "Vo Thanh Nam",
        "customer_phone": "0901000003",
        "address": "Tan Tao, Binh Tan, Ho Chi Minh City",
        "latitude": 10.7658,
        "longitude": 106.5961,
        "weight_kg": 18.0,
        "status": OrderStatus.PENDING,
    },
    {
        "order_code": "LR-HCM-004",
        "customer_name": "Nguyen Ngoc Ha",
        "customer_phone": "0901000004",
        "address": "Thao Dien, Thu Duc, Ho Chi Minh City",
        "latitude": 10.8038,
        "longitude": 106.7337,
        "weight_kg": 4.5,
        "status": OrderStatus.DELIVERED,
    },
    {
        "order_code": "LR-HCM-005",
        "customer_name": "Bui Quoc Bao",
        "customer_phone": "0901000005",
        "address": "Ward 10, Phu Nhuan, Ho Chi Minh City",
        "latitude": 10.7992,
        "longitude": 106.6805,
        "weight_kg": 9.0,
        "status": OrderStatus.PENDING,
    },
]

SEED_USERS = [
    {
        "email": "admin@logiroute.vn",
        "password": "123456",
        "full_name": "LogiRoute Admin",
        "role": UserRole.ADMIN,
    },
    {
        "email": "dispatcher@logiroute.vn",
        "password": "123456",
        "full_name": "LogiRoute Dispatcher",
        "role": UserRole.DISPATCHER,
    },
    {
        "email": "driver1@logiroute.vn",
        "password": "123456",
        "full_name": "LogiRoute Driver 1",
        "role": UserRole.DRIVER,
    },
]


@router.post("/seed", response_model=SeedResponse, status_code=status.HTTP_201_CREATED)
def seed_data(db: Session = Depends(get_db)) -> SeedResponse:
    """Insert the local demo dataset once; repeated calls remain idempotent."""
    depot = db.scalar(select(Depot).where(Depot.name == SEED_DEPOT["name"]))
    depot_created = depot is None
    if depot is None:
        depot = Depot(**SEED_DEPOT)
        db.add(depot)

    vehicles_created = 0
    for vehicle_data in SEED_VEHICLES:
        exists = db.scalar(
            select(Vehicle).where(Vehicle.license_plate == vehicle_data["license_plate"])
        )
        if exists is None:
            db.add(Vehicle(**vehicle_data))
            vehicles_created += 1

    orders_created = 0
    for order_data in SEED_ORDERS:
        exists = db.scalar(select(Order).where(Order.order_code == order_data["order_code"]))
        if exists is None:
            db.add(Order(**order_data))
            orders_created += 1
        elif exists.customer_phone is None:
            exists.customer_phone = order_data["customer_phone"]

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Seed data conflicts with existing records") from exc

    primary_vehicle = db.scalar(
        select(Vehicle).where(Vehicle.license_plate == SEED_VEHICLES[0]["license_plate"])
    )
    if primary_vehicle is not None:
        assigned_orders = list(
            db.scalars(
                select(Order)
                .where(
                    Order.status == OrderStatus.ASSIGNED,
                    Order.assigned_vehicle_id.is_(None),
                )
                .order_by(Order.order_code)
            ).all()
        )
        for sequence, order in enumerate(assigned_orders, start=1):
            order.assigned_vehicle_id = primary_vehicle.id
            order.stop_sequence = sequence
        if assigned_orders:
            db.commit()

    db.refresh(depot)
    return SeedResponse(
        depot_created=depot_created,
        vehicles_created=vehicles_created,
        orders_created=orders_created,
        depot=DepotRead.model_validate(depot),
    )


@router.post("/seed/users", response_model=SeedUsersResponse, status_code=status.HTTP_201_CREATED)
def seed_users(db: Session = Depends(get_db)) -> SeedUsersResponse:
    """Create local demo users once; repeated calls do not overwrite accounts."""
    created_count = 0
    for user_data in SEED_USERS:
        exists = db.scalar(select(User).where(User.email == user_data["email"]))
        if exists is None:
            db.add(
                User(
                    email=user_data["email"],
                    hashed_password=get_password_hash(user_data["password"]),
                    full_name=user_data["full_name"],
                    role=user_data["role"],
                    status=UserStatus.ACTIVE,
                )
            )
            created_count += 1

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Seed users conflict with existing records") from exc

    driver_user = db.scalar(
        select(User).where(User.email == "driver1@logiroute.vn")
    )
    primary_vehicle = db.scalar(
        select(Vehicle).where(Vehicle.license_plate == SEED_VEHICLES[0]["license_plate"])
    )
    if driver_user is not None and primary_vehicle is not None:
        primary_vehicle.driver_id = driver_user.id
        db.commit()

    users = list(
        db.scalars(
            select(User).where(User.email.in_([user["email"] for user in SEED_USERS])).order_by(User.email)
        ).all()
    )
    return SeedUsersResponse(
        created_count=created_count,
        users=[UserRead.model_validate(user) for user in users],
    )
