from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import Depot, Order, OrderStatus, Vehicle, VehicleStatus
from app.db.session import get_db
from app.schemas import DepotRead, SeedResponse


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
        "address": "Ben Nghe, Quan 1, Ho Chi Minh City",
        "latitude": 10.7769,
        "longitude": 106.7009,
        "weight_kg": 12.5,
        "status": OrderStatus.ASSIGNED,
    },
    {
        "order_code": "LR-HCM-002",
        "customer_name": "Le Minh Anh",
        "address": "Ward 5, Go Vap, Ho Chi Minh City",
        "latitude": 10.8387,
        "longitude": 106.6653,
        "weight_kg": 6.0,
        "status": OrderStatus.PENDING,
    },
    {
        "order_code": "LR-HCM-003",
        "customer_name": "Vo Thanh Nam",
        "address": "Tan Tao, Binh Tan, Ho Chi Minh City",
        "latitude": 10.7658,
        "longitude": 106.5961,
        "weight_kg": 18.0,
        "status": OrderStatus.PENDING,
    },
    {
        "order_code": "LR-HCM-004",
        "customer_name": "Nguyen Ngoc Ha",
        "address": "Thao Dien, Thu Duc, Ho Chi Minh City",
        "latitude": 10.8038,
        "longitude": 106.7337,
        "weight_kg": 4.5,
        "status": OrderStatus.DELIVERED,
    },
    {
        "order_code": "LR-HCM-005",
        "customer_name": "Bui Quoc Bao",
        "address": "Ward 10, Phu Nhuan, Ho Chi Minh City",
        "latitude": 10.7992,
        "longitude": 106.6805,
        "weight_kg": 9.0,
        "status": OrderStatus.PENDING,
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

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Seed data conflicts with existing records") from exc

    db.refresh(depot)
    return SeedResponse(
        depot_created=depot_created,
        vehicles_created=vehicles_created,
        orders_created=orders_created,
        depot=DepotRead.model_validate(depot),
    )
