import random
from base64 import b64decode
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.core.config import SIGNATURE_PUBLIC_BASE_URL, SIGNATURE_UPLOAD_DIR
from app.db.models import (
    CustomerNotification,
    Depot,
    NotificationChannel,
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
from app.services.notification_service import (
    notification_template_for_status,
    send_order_notification,
)


router = APIRouter(tags=["seed"])

SEED_SIGNATURE_FILENAME = "seed-recipient-signature.png"
SEED_SIGNATURE_PNG = b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAUAAAABkCAYAAAD32uk+AAADuklEQVR42u3dTXLUOhSA0eyAIXtg//sLI0YEquPW/dU5VR6+59iRvpbVTvHxAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB7/Pj569NdAK6M35/D3QCujJ8IAgIIcGP8RBAQQIAb43dDAEUeBPDKCFrpgvhdGUCP+yCAX0bghjgIIIjflwHYHgdf+rx//9wFBFAArx437gZrHwG3xuH2b71tG2AgvzCQKwZ71jlE8Nx9c2cQwEGPVgJo2wAD+aUBnDXYK89jQts2QACvDWDV474AQuP4ZYUhc2IJoFWz363B/K2BGz3YsybVza/9CODf1+I3ayB/Rv53pyZX1vVPj6AVc49tFhYOgKjBkxXArq/9dF/ZbAmg/ctn90sAA+OQObk2B7DqQ2PS/RLAy+/Puxd2QwCtbHZ+YFTvX06+L2sieOKiTt6YzC8kOr72I4D9JnrGuacET/wKA5h9ro2PdVm/56jVevTYr3y9a0L0PP4W/38qf+YJAyFyYlcGMHPbo/KLveq/dLrmxfbKx8kO+3ECGLvXW7VS7xrAitgI3qAAZq8uNgYwcmJX3a+qx/jogP/vg+nkHBK9xP2ZKSuM6he/M19MrgxZxoTu/hj/6s/99DoFr0kAsydK1buLpye1AOY9ymc/xlfETPQuCWC3iRkxITpM7Ir3RCMe5aePMcFrHr8pj7JVL35HDtCo+1Cx1xq1kt2wchQ9AWy7MX9qUHdadXffc8v6QiNjxSx4C+LXZZM5+vpPTNQTAzlyYme/xhL5YZYxzir3+5StUQC7DczqAJ6eOFn3b0IAo/YLT3xYPPmmVwQXxC/z8aoiuBHnPPX6w6nrmPbicdaftX03SFFxEz8BLD1fxDnfmQAZEzvqXk0KefQq7skWiLI1i1/2/lL2o1D0+V6ZFNkTO2o8ZIc88zo8wgpgmwBWvPeY+R5Y9MTOCseE6zgVQVW6NIAV/7ZHdgCj/wa2yytM3VZnlVsEoid+5ZO4QwAnPtb963xZ4yF67FnlCWDbAE4ObtY1Zk+w6f/I/ZPrsMoTv5IIbo9u1Hk2jMmO80PwBDBtkG1fdU5anWWPyanBEz3xax2ITtE1CnvOA8ETwNU/S4cAGoFzg+f3J37jf57K6BqBVnkIYGkgqqJr9FnlTbn+1R8CHS+s8t8+lQ3hq4jKtGPdgDFp3INNqxSHCCIqDof4ISgOh/iJisMhVAiVwyEqiJ9DUED8RAUQQUEBYiPozgIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANDQb+y3GpHXeJMKAAAAAElFTkSuQmCC"
)

SEED_DEPOTS = [
    {
        "code": "HUB-SGN",
        "name": "Hub Miền Nam - Kho Quận 12",
        "city": "TP. Hồ Chí Minh",
        "address": "12 Quốc Lộ 1A, Quận 12, TP. Hồ Chí Minh",
        "latitude": 10.8671,
        "longitude": 106.6412,
        "is_default": True,
    },
    {
        "code": "HUB-HAN",
        "name": "Hub Miền Bắc - Kho Long Biên",
        "city": "Hà Nội",
        "address": "Khu công nghiệp Đài Tư, Quận Long Biên, Hà Nội",
        "latitude": 21.0362,
        "longitude": 105.9015,
        "is_default": False,
    },
    {
        "code": "HUB-DAD",
        "name": "Hub Miền Trung - Kho Hòa Cầm",
        "city": "Đà Nẵng",
        "address": "Khu công nghiệp Hòa Cầm, Quận Cẩm Lệ, Đà Nẵng",
        "latitude": 16.0125,
        "longitude": 108.1822,
        "is_default": False,
    },
    {
        "code": "HUB-VCA",
        "name": "Hub Tây Nam Bộ - Kho Cái Răng",
        "city": "Cần Thơ",
        "address": "Khu công nghiệp Hưng Phú 1, Quận Cái Răng, Cần Thơ",
        "latitude": 10.0072,
        "longitude": 105.8011,
        "is_default": False,
    },
]

SEED_VEHICLES = [
    {
        "license_plate": "51D-12001",
        "capacity_kg": 1200,
        "vehicle_type": "TRUCK",
        "driver_name": "Nguyen Van Minh",
        "status": VehicleStatus.ON_ROUTE,
        "service_area": "TP. Ho Chi Minh",
    },
    {
        "license_plate": "51D-12002",
        "capacity_kg": 800,
        "vehicle_type": "VAN",
        "driver_name": "Tran Thi Lan",
        "status": VehicleStatus.IDLE,
        "service_area": "TP. Ho Chi Minh",
    },
    {
        "license_plate": "51D-12003",
        "capacity_kg": 1000,
        "vehicle_type": "TRUCK",
        "driver_name": "Huynh Tai",
        "status": VehicleStatus.IDLE,
        "service_area": "Tay Bac TP.HCM",
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
        "phone_number": "1900636099",
        "role": UserRole.ADMIN,
    },
    {
        "email": "dispatcher@logiroute.vn",
        "password": "123456",
        "full_name": "LogiRoute Dispatcher",
        "phone_number": "0909000001",
        "role": UserRole.DISPATCHER,
    },
    {
        "email": "driver1@logiroute.vn",
        "password": "123456",
        "full_name": "Nguyen Van Minh",
        "phone_number": "0909000101",
        "role": UserRole.DRIVER,
    },
    {
        "email": "driver2@logiroute.vn",
        "password": "123456",
        "full_name": "Tran Thi Lan",
        "phone_number": "0909000102",
        "role": UserRole.DRIVER,
    },
    {
        "email": "driver3@logiroute.vn",
        "password": "123456",
        "full_name": "Huynh Tai",
        "phone_number": "0909000103",
        "role": UserRole.DRIVER,
    },
]

SEED_DRIVER_PERFORMANCE = [
    {
        "email": "driver1@logiroute.vn",
        "license_plate": "51D-12001",
        "delivered": 12,
        "failed": 1,
        "latitude_delta": 0.34,
        "longitude_delta": 0.08,
        "deviation_status": "ON_ROUTE",
    },
    {
        "email": "driver2@logiroute.vn",
        "license_plate": "51D-12002",
        "delivered": 9,
        "failed": 3,
        "latitude_delta": 0.22,
        "longitude_delta": 0.06,
        "deviation_status": "STOPPED",
    },
    {
        "email": "driver3@logiroute.vn",
        "license_plate": "51D-12003",
        "delivered": 5,
        "failed": 5,
        "latitude_delta": 0.12,
        "longitude_delta": 0.04,
        "deviation_status": "OFF_ROUTE_WARNING",
    },
]


def ensure_seed_users(db: Session) -> tuple[dict[str, User], int]:
    created_count = 0
    users_by_email: dict[str, User] = {}
    for user_data in SEED_USERS:
        user = db.scalar(select(User).where(User.email == user_data["email"]))
        if user is None:
            user = User(
                email=user_data["email"],
                hashed_password=get_password_hash(user_data["password"]),
                full_name=user_data["full_name"],
                phone_number=user_data["phone_number"],
                role=user_data["role"],
                status=UserStatus.ACTIVE,
            )
            db.add(user)
            created_count += 1
        users_by_email[user_data["email"]] = user
    db.flush()
    return users_by_email, created_count


def seed_driver_performance_history(
    db: Session,
    *,
    depot: Depot,
    users_by_email: dict[str, User],
    vehicles_by_plate: dict[str, Vehicle],
    now: datetime | None = None,
) -> int:
    """Create deterministic terminal-order history without changing live orders."""
    reference = now or datetime.now(timezone.utc)
    created_count = 0
    for driver_index, profile in enumerate(SEED_DRIVER_PERFORMANCE, start=1):
        driver = users_by_email[profile["email"]]
        vehicle = vehicles_by_plate[profile["license_plate"]]
        if vehicle.driver_id in {None, driver.id}:
            vehicle.driver_id = driver.id
            vehicle.driver_name = driver.full_name
        vehicle.route_deviation_status = profile["deviation_status"]

        delivered = int(profile["delivered"])
        failed = int(profile["failed"])
        for index in range(delivered + failed):
            order_code = f"LR-PERF-{driver_index}-{index + 1:02d}"
            if db.scalar(select(Order.id).where(Order.order_code == order_code)):
                continue
            day_offset = (index * 2 + driver_index) % 29
            latitude = depot.latitude + float(profile["latitude_delta"]) + index * 0.003
            longitude = depot.longitude + float(profile["longitude_delta"]) - index * 0.002
            db.add(
                Order(
                    depot_id=depot.id,
                    order_code=order_code,
                    tracking_token=generate_tracking_token(),
                    customer_name=f"Performance Customer {driver_index}-{index + 1}",
                    customer_phone=f"0908{driver_index:02d}{index:04d}",
                    address=f"Demo delivery point {driver_index}-{index + 1}",
                    latitude=latitude,
                    longitude=longitude,
                    weight_kg=20 + index * 3,
                    status=(
                        OrderStatus.DELIVERED
                        if index < delivered
                        else OrderStatus.FAILED
                    ),
                    status_updated_at=(
                        reference
                        - timedelta(days=day_offset, hours=(index * 3) % 20)
                    ),
                    assigned_vehicle_id=vehicle.id,
                    stop_sequence=1,
                    delivery_region=vehicle.service_area,
                )
            )
            created_count += 1
    return created_count


def build_seed_analytics_snapshots(
    *,
    now: datetime | None = None,
    count: int = 25,
    depot_id: UUID | None = None,
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
                depot_id=depot_id,
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
    # Keep the database-level single-default invariant deterministic for demos.
    db.execute(update(Depot).values(is_default=False))
    depots_created = 0
    depots_by_code: dict[str, Depot] = {}
    for depot_data in SEED_DEPOTS:
        depot = db.scalar(select(Depot).where(Depot.code == depot_data["code"]))
        if depot is None:
            depot = Depot(**depot_data)
            db.add(depot)
            depots_created += 1
        else:
            for field, value in depot_data.items():
                setattr(depot, field, value)
        depots_by_code[depot_data["code"]] = depot
    db.flush()
    depot = depots_by_code["HUB-SGN"]
    depot_created = depots_created > 0
    users_by_email, _users_created = ensure_seed_users(db)

    vehicles_created = 0
    for vehicle_data in SEED_VEHICLES:
        exists = db.scalar(
            select(Vehicle).where(Vehicle.license_plate == vehicle_data["license_plate"])
        )
        if exists is None:
            db.add(Vehicle(**vehicle_data, depot_id=depot.id))
            vehicles_created += 1
        elif exists.depot_id is None:
            exists.depot_id = depot.id
    db.flush()
    vehicles_by_plate = {
        vehicle.license_plate: vehicle
        for vehicle in db.scalars(
            select(Vehicle).where(
                Vehicle.license_plate.in_(
                    [vehicle["license_plate"] for vehicle in SEED_VEHICLES]
                )
            )
        ).all()
    }

    orders_created = seed_driver_performance_history(
        db,
        depot=depot,
        users_by_email=users_by_email,
        vehicles_by_plate=vehicles_by_plate,
    )
    seeded_orders: list[Order] = []
    for order_data in SEED_ORDERS:
        exists = db.scalar(select(Order).where(Order.order_code == order_data["order_code"]))
        if exists is None:
            order = Order(
                **order_data,
                tracking_token=generate_tracking_token(),
                depot_id=depot.id,
            )
            db.add(order)
            seeded_orders.append(order)
            orders_created += 1
        else:
            if exists.depot_id is None:
                exists.depot_id = depot.id
            if not exists.tracking_token:
                exists.tracking_token = generate_tracking_token()
            if exists.customer_phone is None:
                exists.customer_phone = order_data["customer_phone"]
            seeded_orders.append(exists)

    delivered_orders = [
        order for order in seeded_orders if order.status is OrderStatus.DELIVERED
    ]
    if delivered_orders:
        SIGNATURE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        signature_path = SIGNATURE_UPLOAD_DIR / SEED_SIGNATURE_FILENAME
        if not signature_path.exists():
            signature_path.write_bytes(SEED_SIGNATURE_PNG)
        for delivered_order in delivered_orders:
            if not delivered_order.signature_url:
                delivered_order.signature_url = (
                    f"{SIGNATURE_PUBLIC_BASE_URL}/uploads/signatures/"
                    f"{SEED_SIGNATURE_FILENAME}"
                )
                delivered_order.signature_uploaded_at = datetime.now(timezone.utc)
                delivered_order.recipient_name = delivered_order.customer_name

    existing_analytics = int(db.scalar(
        select(func.count()).select_from(RouteAnalyticsSnapshot)
    ) or 0)
    analytics_snapshots_created = max(0, 25 - existing_analytics)
    if analytics_snapshots_created:
        snapshots = build_seed_analytics_snapshots(
            count=analytics_snapshots_created,
            depot_id=depot.id,
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
                    Order.depot_id == depot.id,
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
                .where(
                    Vehicle.depot_id == depot.id,
                    Vehicle.status == VehicleStatus.ON_ROUTE,
                )
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

    seeded_notifications_created = 0
    for index, order in enumerate(seeded_orders):
        template_code = notification_template_for_status(order.status)
        already_seeded = db.scalar(
            select(CustomerNotification.id)
            .where(CustomerNotification.order_id == order.id)
            .limit(1)
        )
        if template_code is None or already_seeded is not None:
            continue
        notification = send_order_notification(
            db,
            order=order,
            template_code=template_code,
            channel=(
                NotificationChannel.ZALO_ZNS
                if index % 2 == 0
                else NotificationChannel.SMS_BRANDNAME
            ),
        )
        if notification is not None:
            seeded_notifications_created += 1
    if seeded_notifications_created:
        db.commit()

    db.refresh(depot)
    return SeedResponse(
        depot_created=depot_created,
        depots_created=depots_created,
        vehicles_created=vehicles_created,
        orders_created=orders_created,
        analytics_snapshots_created=analytics_snapshots_created,
        depot=DepotRead.model_validate(depot),
    )


@router.post("/seed/users", response_model=SeedUsersResponse, status_code=status.HTTP_201_CREATED)
def seed_users(db: Session = Depends(get_db)) -> SeedUsersResponse:
    """Create local demo users once; repeated calls do not overwrite accounts."""
    _users_by_email, created_count = ensure_seed_users(db)

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
