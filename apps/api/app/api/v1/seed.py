import random
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.db.models import (
    Depot,
    Order,
    OrderActivityLog,
    OrderStatus,
    RouteAnalyticsSnapshot,
    User,
    UserRole,
    UserStatus,
    Vehicle,
    VehicleStatus,
)
from app.db.session import get_db
from app.schemas import DepotRead, SeedResponse, SeedUsersResponse, UserRead
from app.services.cost_calculator import calculate_route_costs
from app.services.activity_logger import log_order_activity
from app.services.public_tracking import generate_tracking_token


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


def build_seed_analytics_snapshots(
    *,
    now: datetime | None = None,
    count: int = 25,
) -> list[RouteAnalyticsSnapshot]:
    """Build deterministic, realistic demo history without touching the database."""
    reference = now or datetime.now(timezone.utc)
    generator = random.Random(20260731)
    snapshots: list[RouteAnalyticsSnapshot] = []

    for index in range(count):
        distance = round(generator.uniform(40, 120), 2)
        duration = round(generator.uniform(95, 260), 2)
        savings_rate = round(generator.uniform(0.15, 0.22), 4)
        costs = calculate_route_costs(
            total_distance_km=distance,
            total_time_minutes=duration,
        )
        day_offset = round(index * 29 / max(count - 1, 1))
        created_at = (
            reference
            - timedelta(days=day_offset)
            - timedelta(hours=generator.randint(0, 18))
        )
        snapshots.append(
            RouteAnalyticsSnapshot(
                total_distance_km=distance,
                total_duration_mins=duration,
                fuel_cost_vnd=costs.fuel_cost_vnd,
                driver_cost_vnd=costs.driver_cost_vnd,
                total_cost_vnd=costs.total_cost_vnd,
                co2_emissions_kg=costs.co2_emissions_kg,
                estimated_savings_vnd=round(
                    costs.total_cost_vnd * savings_rate,
                    2,
                ),
                estimated_co2_savings_kg=round(
                    costs.co2_emissions_kg * savings_rate,
                    3,
                ),
                savings_rate=savings_rate,
                created_at=created_at,
            )
        )

    return snapshots


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
    seeded_orders: list[Order] = []
    for order_data in SEED_ORDERS:
        exists = db.scalar(select(Order).where(Order.order_code == order_data["order_code"]))
        if exists is None:
            order = Order(**order_data, tracking_token=generate_tracking_token())
            db.add(order)
            seeded_orders.append(order)
            orders_created += 1
        else:
            if not exists.tracking_token:
                exists.tracking_token = generate_tracking_token()
            if exists.customer_phone is None:
                exists.customer_phone = order_data["customer_phone"]
            seeded_orders.append(exists)

    existing_analytics = int(db.scalar(
        select(func.count()).select_from(RouteAnalyticsSnapshot)
    ) or 0)
    analytics_snapshots_created = max(0, 25 - existing_analytics)
    if analytics_snapshots_created:
        snapshots = build_seed_analytics_snapshots(
            count=analytics_snapshots_created
        )
        db.add_all(snapshots)

    try:
        db.flush()
        seeded_order_ids = [order.id for order in seeded_orders]
        logged_seed_order_ids = set(
            db.scalars(
                select(OrderActivityLog.order_id).where(
                    OrderActivityLog.order_id.in_(seeded_order_ids),
                    OrderActivityLog.action == "CREATED",
                )
            ).all()
        )
        for order in seeded_orders:
            if order.id not in logged_seed_order_ids:
                log_order_activity(
                    db,
                    order_id=order.id,
                    action="CREATED",
                    new_status=order.status.value,
                    detail="Seeded demo order",
                )
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
        active_vehicles = list(
            db.scalars(
                select(Vehicle)
                .where(Vehicle.status == VehicleStatus.ON_ROUTE)
                .order_by(Vehicle.license_plate)
            ).all()
        )
        demo_positions = [
            (10.8671, 106.6412, 27.0),
            (10.8387, 106.6653, 18.0),
        ]
        gps_now = datetime.now(timezone.utc)
        for index, vehicle in enumerate(active_vehicles):
            latitude, longitude, speed_kmh = demo_positions[
                index % len(demo_positions)
            ]
            vehicle.current_latitude = latitude
            vehicle.current_longitude = longitude
            vehicle.current_speed_kmh = speed_kmh
            vehicle.last_gps_ping_at = gps_now
            vehicle.route_deviation_status = "ON_ROUTE"
        if assigned_orders or active_vehicles:
            db.commit()

    db.refresh(depot)
    return SeedResponse(
        depot_created=depot_created,
        vehicles_created=vehicles_created,
        orders_created=orders_created,
        analytics_snapshots_created=analytics_snapshots_created,
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
