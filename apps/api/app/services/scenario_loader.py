from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.core.config import (
    POD_PUBLIC_BASE_URL,
    POD_UPLOAD_DIR,
    SIGNATURE_PUBLIC_BASE_URL,
    SIGNATURE_UPLOAD_DIR,
)
from app.core.security import get_password_hash
from app.db.models import (
    CodStatus,
    CustomerNotification,
    Depot,
    NotificationChannel,
    Order,
    OrderActivityLog,
    OrderStatus,
    PaymentMethod,
    RouteAnalyticsSnapshot,
    User,
    UserRole,
    UserStatus,
    Vehicle,
    VehicleStatus,
)
from app.schemas import ScenarioLoadResponse, ScenarioType
from app.services.activity_logger import log_order_activity
from app.services.cost_calculator import calculate_route_costs
from app.services.notification_service import (
    ORDER_DELIVERED,
    ORDER_OUT_FOR_DELIVERY,
    send_order_notification,
)
from app.services.public_tracking import generate_tracking_token


SCENARIO_DEPOTS = {
    ScenarioType.HCMC_PEAK_DAY: {
        "code": "HUB-SGN",
        "name": "Hub Miền Nam - Kho Quận 12",
        "city": "TP. Hồ Chí Minh",
        "address": "12 Quốc Lộ 1A, Quận 12, TP. Hồ Chí Minh",
        "latitude": 10.8671,
        "longitude": 106.6412,
        "is_default": True,
    },
    ScenarioType.HANOI_EXPRESS: {
        "code": "HUB-HAN",
        "name": "Hub Miền Bắc - Kho Long Biên",
        "city": "Hà Nội",
        "address": "Khu công nghiệp Đài Tư, Quận Long Biên, Hà Nội",
        "latitude": 21.0362,
        "longitude": 105.9015,
        "is_default": False,
    },
    ScenarioType.MULTI_REGION: {
        "code": "HUB-SGN",
        "name": "Hub Miền Nam - Điều phối liên vùng",
        "city": "TP. Hồ Chí Minh",
        "address": "12 Quốc Lộ 1A, Quận 12, TP. Hồ Chí Minh",
        "latitude": 10.8671,
        "longitude": 106.6412,
        "is_default": True,
    },
}

DRIVER_SPECS = (
    {
        "email": "driver1@logiroute.vn",
        "full_name": "Nguyen Van Minh",
        "phone_number": "0901234567",
        "plate": "51D-12001",
        "capacity": 1200.0,
        "service_area": "Quận 1 · Quận 3 · Bình Thạnh",
    },
    {
        "email": "driver2@logiroute.vn",
        "full_name": "Tran Quoc Bao",
        "phone_number": "0902345678",
        "plate": "51D-12002",
        "capacity": 1000.0,
        "service_area": "Gò Vấp · Quận 12 · Hóc Môn",
    },
    {
        "email": "driver3@logiroute.vn",
        "full_name": "Huynh Minh Tai",
        "phone_number": "0903456789",
        "plate": "51D-12003",
        "capacity": 1500.0,
        "service_area": "Thủ Đức · Bình Thạnh",
    },
)

HCMC_STOPS = (
    ("Quận 1", "45 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM", 10.7734, 106.7041),
    ("Quận 3", "179 Võ Thị Sáu, Phường Võ Thị Sáu, Quận 3, TP.HCM", 10.7872, 106.6907),
    ("Bình Thạnh", "208 Xô Viết Nghệ Tĩnh, Quận Bình Thạnh, TP.HCM", 10.8030, 106.7090),
    ("Gò Vấp", "12 Phan Văn Trị, Quận Gò Vấp, TP.HCM", 10.8285, 106.6842),
    ("Hóc Môn", "Chợ Bà Điểm, Huyện Hóc Môn, TP.HCM", 10.8428, 106.5979),
    ("Thủ Đức", "Khu Công nghệ cao, TP. Thủ Đức, TP.HCM", 10.8412, 106.8099),
    ("Quận 1", "72 Lê Thánh Tôn, Phường Bến Nghé, Quận 1, TP.HCM", 10.7761, 106.7010),
    ("Quận 3", "280 Nam Kỳ Khởi Nghĩa, Quận 3, TP.HCM", 10.7895, 106.6848),
    ("Bình Thạnh", "Landmark 81, Quận Bình Thạnh, TP.HCM", 10.7948, 106.7220),
    ("Gò Vấp", "640 Quang Trung, Quận Gò Vấp, TP.HCM", 10.8382, 106.6576),
    ("Hóc Môn", "Ngã ba Giồng, Huyện Hóc Môn, TP.HCM", 10.8914, 106.5968),
    ("Thủ Đức", "Vincom Thủ Đức, TP. Thủ Đức, TP.HCM", 10.8503, 106.7717),
)

HANOI_STOPS = (
    ("Hoàn Kiếm", "Hàng Bài, Quận Hoàn Kiếm, Hà Nội", 21.0226, 105.8522),
    ("Ba Đình", "Kim Mã, Quận Ba Đình, Hà Nội", 21.0319, 105.8188),
    ("Cầu Giấy", "Duy Tân, Quận Cầu Giấy, Hà Nội", 21.0302, 105.7827),
    ("Hai Bà Trưng", "Minh Khai, Quận Hai Bà Trưng, Hà Nội", 20.9988, 105.8610),
    ("Long Biên", "Ngọc Lâm, Quận Long Biên, Hà Nội", 21.0456, 105.8744),
    ("Tây Hồ", "Xuân Diệu, Quận Tây Hồ, Hà Nội", 21.0642, 105.8266),
    ("Thanh Xuân", "Nguyễn Trãi, Quận Thanh Xuân, Hà Nội", 20.9958, 105.8077),
    ("Hà Đông", "Tố Hữu, Quận Hà Đông, Hà Nội", 20.9951, 105.7703),
    ("Nam Từ Liêm", "Mỹ Đình, Quận Nam Từ Liêm, Hà Nội", 21.0128, 105.7621),
    ("Đống Đa", "Tây Sơn, Quận Đống Đa, Hà Nội", 21.0093, 105.8240),
    ("Gia Lâm", "Trâu Quỳ, Huyện Gia Lâm, Hà Nội", 21.0198, 105.9361),
    ("Hoàng Mai", "Linh Đàm, Quận Hoàng Mai, Hà Nội", 20.9647, 105.8276),
)

MULTI_REGION_STOPS = HCMC_STOPS[:6] + (
    ("Biên Hòa", "KCN Amata, TP. Biên Hòa, Đồng Nai", 10.9451, 106.8779),
    ("Thuận An", "VSIP 1, TP. Thuận An, Bình Dương", 10.9448, 106.7117),
    ("Dĩ An", "Làng Đại học, TP. Dĩ An, Bình Dương", 10.8796, 106.8030),
    ("Tân An", "Trung tâm TP. Tân An, Long An", 10.5356, 106.4137),
    ("Bến Lức", "Thị trấn Bến Lức, Long An", 10.6425, 106.4934),
    ("Nhơn Trạch", "KCN Nhơn Trạch, Đồng Nai", 10.7218, 106.9497),
)

# Delivered stops the customer paid by bank transfer instead of cash.
VIETQR_STOP_INDEXES = frozenset({2, 4})

SCENARIO_STOPS = {
    ScenarioType.HCMC_PEAK_DAY: HCMC_STOPS,
    ScenarioType.HANOI_EXPRESS: HANOI_STOPS,
    ScenarioType.MULTI_REGION: MULTI_REGION_STOPS,
}

POD_FILENAME = "scenario-delivery-proof.svg"
SIGNATURE_FILENAME = "scenario-recipient-signature.svg"
POD_SVG = """<svg xmlns="http://www.w3.org/2000/svg" width="720" height="420" viewBox="0 0 720 420"><rect width="720" height="420" fill="#e2e8f0"/><rect x="38" y="38" width="644" height="344" rx="24" fill="#fff"/><path d="M95 290h530l-52-118H202l-43 62H95z" fill="#0d9488"/><circle cx="230" cy="305" r="36" fill="#0f172a"/><circle cx="529" cy="305" r="36" fill="#0f172a"/><text x="360" y="112" text-anchor="middle" font-family="Arial" font-size="32" font-weight="700" fill="#0f172a">LOGIROUTE VN</text><text x="360" y="152" text-anchor="middle" font-family="Arial" font-size="20" fill="#475569">Proof of Delivery · Demo Scenario</text><path d="m592 76 18 18 36-42" fill="none" stroke="#10b981" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>"""
SIGNATURE_SVG = """<svg xmlns="http://www.w3.org/2000/svg" width="420" height="140" viewBox="0 0 420 140"><path d="M25 92c44-82 17 36 72-21s-10 87 54 1c23-31 5 70 51 6 31-43 16 50 68-2 30-30 21 35 68 0 19-14 35-14 57-9" fill="none" stroke="#0f172a" stroke-width="4" stroke-linecap="round"/><path d="M40 115c106 9 232 7 344-4" fill="none" stroke="#64748b" stroke-width="2" stroke-dasharray="8 8"/></svg>"""


def _ensure_demo_assets() -> tuple[str, str]:
    POD_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    SIGNATURE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    (POD_UPLOAD_DIR / POD_FILENAME).write_text(POD_SVG, encoding="utf-8")
    (SIGNATURE_UPLOAD_DIR / SIGNATURE_FILENAME).write_text(
        SIGNATURE_SVG,
        encoding="utf-8",
    )
    return (
        f"{POD_PUBLIC_BASE_URL}/uploads/pod/{POD_FILENAME}",
        f"{SIGNATURE_PUBLIC_BASE_URL}/uploads/signatures/{SIGNATURE_FILENAME}",
    )


def _ensure_depot(db: Session, scenario_type: ScenarioType) -> Depot:
    depot_data = SCENARIO_DEPOTS[scenario_type]
    if depot_data["is_default"]:
        db.execute(update(Depot).values(is_default=False))
    depot = db.scalar(select(Depot).where(Depot.code == depot_data["code"]))
    if depot is None:
        depot = Depot(**depot_data)
        db.add(depot)
    else:
        for field, value in depot_data.items():
            setattr(depot, field, value)
    db.flush()
    return depot


def _ensure_drivers(db: Session) -> dict[str, User]:
    drivers: dict[str, User] = {}
    for spec in DRIVER_SPECS:
        driver = db.scalar(select(User).where(User.email == spec["email"]))
        if driver is None:
            driver = User(
                email=spec["email"],
                hashed_password=get_password_hash("123456"),
                full_name=spec["full_name"],
                phone_number=spec["phone_number"],
                role=UserRole.DRIVER,
                status=UserStatus.ACTIVE,
            )
            db.add(driver)
        else:
            driver.full_name = spec["full_name"]
            driver.phone_number = spec["phone_number"]
            driver.role = UserRole.DRIVER
            driver.status = UserStatus.ACTIVE
        drivers[spec["email"]] = driver
    db.flush()
    return drivers


def _create_scenario_vehicles(
    db: Session,
    *,
    depot: Depot,
    drivers: dict[str, User],
    now: datetime,
) -> list[Vehicle]:
    positions = (
        (depot.latitude - 0.018, depot.longitude + 0.023, 31.0),
        (depot.latitude - 0.030, depot.longitude - 0.016, 24.0),
    )
    vehicles: list[Vehicle] = []
    for index, spec in enumerate(DRIVER_SPECS):
        active = index < 2
        latitude, longitude, speed = positions[index] if active else (None, None, 0.0)
        vehicle = Vehicle(
            depot_id=depot.id,
            license_plate=spec["plate"],
            capacity_kg=spec["capacity"],
            vehicle_type="TRUCK",
            driver_name=spec["full_name"],
            driver_id=drivers[spec["email"]].id,
            status=VehicleStatus.ON_ROUTE if active else VehicleStatus.IDLE,
            service_area=spec["service_area"],
            current_latitude=latitude,
            current_longitude=longitude,
            current_speed_kmh=speed,
            last_gps_ping_at=now if active else None,
            route_deviation_status="ON_ROUTE",
        )
        db.add(vehicle)
        vehicles.append(vehicle)
    db.flush()
    return vehicles


def _create_scenario_orders(
    db: Session,
    *,
    scenario_type: ScenarioType,
    depot: Depot,
    vehicles: list[Vehicle],
    pod_url: str,
    signature_url: str,
    now: datetime,
) -> list[Order]:
    statuses = (
        OrderStatus.DELIVERED,
        OrderStatus.DELIVERED,
        OrderStatus.DELIVERED,
        OrderStatus.DELIVERED,
        OrderStatus.DELIVERING,
        OrderStatus.DELIVERING,
        OrderStatus.PENDING,
        OrderStatus.PENDING,
        OrderStatus.PENDING,
        OrderStatus.PENDING,
        OrderStatus.PENDING,
        OrderStatus.PENDING,
    )
    customers = (
        "Nguyễn Minh Anh", "Trần Gia Huy", "Lê Thanh Hà", "Phạm Quốc Bảo",
        "Võ Thùy Dung", "Bùi Hoàng Nam", "Đặng Kim Ngân", "Hoàng Đức Long",
        "Đỗ Khánh Linh", "Ngô Minh Khoa", "Dương Mai Anh", "Huỳnh Gia Phúc",
    )
    weights = (85, 120, 64, 95, 240, 180, 150, 210, 75, 130, 160, 190)
    # Realistic Vietnamese last-mile COD tickets; index 3 and 8 are prepaid.
    cod_amounts = (
        350_000, 720_000, 0, 1_250_000, 480_000, 2_150_000,
        890_000, 0, 615_000, 1_480_000, 275_000, 3_200_000,
    )
    batch_ids = (
        uuid5(NAMESPACE_URL, f"logiroute:{scenario_type.value}:route-1"),
        uuid5(NAMESPACE_URL, f"logiroute:{scenario_type.value}:route-2"),
    )
    orders: list[Order] = []
    for index, ((region, address, latitude, longitude), order_status) in enumerate(
        zip(SCENARIO_STOPS[scenario_type], statuses, strict=True),
        start=1,
    ):
        assigned_vehicle = vehicles[0 if index in (1, 2, 5) else 1] if index <= 6 else None
        route_index = 0 if index in (1, 2, 5) else 1
        stop_sequence = {1: 1, 2: 2, 5: 3, 3: 1, 4: 2, 6: 3}.get(index)
        delivered = order_status is OrderStatus.DELIVERED
        order = Order(
            depot_id=depot.id,
            order_code=f"DEMO-{scenario_type.value[:4]}-{index:03d}",
            tracking_token=generate_tracking_token(),
            customer_name=customers[index - 1],
            customer_phone=f"0908{index:06d}",
            address=address,
            latitude=latitude,
            longitude=longitude,
            weight_kg=float(weights[index - 1]),
            status=order_status,
            status_updated_at=now - timedelta(minutes=(13 - index) * 9),
            assigned_vehicle_id=assigned_vehicle.id if assigned_vehicle else None,
            route_batch_id=batch_ids[route_index] if assigned_vehicle else None,
            stop_sequence=stop_sequence,
            delivery_note="Đã bàn giao đúng người nhận" if delivered else None,
            pod_url=pod_url if delivered else None,
            pod_uploaded_at=now - timedelta(minutes=35 + index) if delivered else None,
            signature_url=signature_url if delivered else None,
            signature_uploaded_at=now - timedelta(minutes=34 + index) if delivered else None,
            recipient_name=customers[index - 1] if delivered else None,
            delivery_region=region,
            cod_amount=Decimal(cod_amounts[index - 1]),
            payment_method=(
                PaymentMethod.PREPAID
                if cod_amounts[index - 1] == 0
                # Stops 2 and 4 are paid by bank QR so the reconciliation KPIs
                # show a real cash/VietQR split rather than an all-cash demo.
                else PaymentMethod.VIETQR
                if index in VIETQR_STOP_INDEXES
                else PaymentMethod.COD_CASH
            ),
            cod_status=(
                CodStatus.COLLECTED
                if delivered and cod_amounts[index - 1] > 0
                else CodStatus.PENDING
            ),
            cod_collected_at=(
                now - timedelta(minutes=36 + index)
                if delivered and cod_amounts[index - 1] > 0
                else None
            ),
        )
        db.add(order)
        orders.append(order)
    db.flush()
    return orders


def _create_activity_and_notifications(
    db: Session,
    *,
    orders: list[Order],
    vehicles: list[Vehicle],
    drivers: dict[str, User],
) -> None:
    drivers_by_id = {driver.id: driver for driver in drivers.values()}
    vehicles_by_id = {vehicle.id: vehicle for vehicle in vehicles}
    for order in orders:
        log_order_activity(
            db,
            order_id=order.id,
            action="CREATED",
            new_status=OrderStatus.PENDING.value,
            detail="Loaded by the guided demo scenario",
        )
        if order.assigned_vehicle_id is None:
            continue
        vehicle = vehicles_by_id[order.assigned_vehicle_id]
        driver = drivers_by_id.get(vehicle.driver_id)
        log_order_activity(
            db,
            order_id=order.id,
            action="ASSIGNED",
            actor=driver,
            old_status=OrderStatus.PENDING.value,
            new_status=OrderStatus.ASSIGNED.value,
            detail=f"Demo route · {vehicle.license_plate}",
        )
        if order.status is not OrderStatus.ASSIGNED:
            log_order_activity(
                db,
                order_id=order.id,
                action="STATUS_CHANGED",
                actor=driver,
                old_status=OrderStatus.ASSIGNED.value,
                new_status=order.status.value,
                detail="Demo delivery progress",
            )
        template = (
            ORDER_DELIVERED
            if order.status is OrderStatus.DELIVERED
            else ORDER_OUT_FOR_DELIVERY
        )
        send_order_notification(
            db,
            order=order,
            template_code=template,
            channel=NotificationChannel.ZALO_ZNS,
            vehicle=vehicle,
            driver=driver,
        )


def _create_analytics(db: Session, *, depot: Depot, now: datetime) -> None:
    distances = (58, 74, 63, 91, 68, 82, 77, 105, 88, 69, 96, 84, 112, 79)
    for index, distance in enumerate(distances):
        duration = round(distance * (2.15 + (index % 3) * 0.08), 2)
        costs = calculate_route_costs(
            total_distance_km=float(distance),
            total_time_minutes=duration,
        )
        db.add(
            RouteAnalyticsSnapshot(
                depot_id=depot.id,
                total_distance_km=float(distance),
                total_duration_mins=duration,
                fuel_cost_vnd=costs.fuel_cost_vnd,
                driver_cost_vnd=costs.driver_cost_vnd,
                total_cost_vnd=costs.total_cost_vnd,
                co2_emissions_kg=costs.co2_emissions_kg,
                estimated_savings_vnd=costs.estimated_savings_vnd,
                estimated_co2_savings_kg=costs.estimated_co2_savings_kg,
                savings_rate=costs.savings_rate,
                created_at=now - timedelta(days=index * 2, hours=index % 4),
            )
        )


def _reset_operational_data(db: Session) -> None:
    # Delete children explicitly so SQLite tests and PostgreSQL behave identically.
    db.execute(delete(CustomerNotification))
    db.execute(delete(OrderActivityLog))
    db.execute(delete(RouteAnalyticsSnapshot))
    db.execute(delete(Order))
    db.execute(delete(Vehicle))


def load_demo_scenario(
    db: Session,
    scenario_type: ScenarioType = ScenarioType.HCMC_PEAK_DAY,
) -> ScenarioLoadResponse:
    """Replace operational demo records atomically while preserving identities."""
    pod_url, signature_url = _ensure_demo_assets()
    now = datetime.now(timezone.utc)
    try:
        _reset_operational_data(db)
        depot = _ensure_depot(db, scenario_type)
        drivers = _ensure_drivers(db)
        vehicles = _create_scenario_vehicles(
            db,
            depot=depot,
            drivers=drivers,
            now=now,
        )
        orders = _create_scenario_orders(
            db,
            scenario_type=scenario_type,
            depot=depot,
            vehicles=vehicles,
            pod_url=pod_url,
            signature_url=signature_url,
            now=now,
        )
        _create_activity_and_notifications(
            db,
            orders=orders,
            vehicles=vehicles,
            drivers=drivers,
        )
        _create_analytics(db, depot=depot, now=now)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return ScenarioLoadResponse(
        scenario_name=scenario_type.value,
        depot_name=depot.name,
        vehicles_loaded=len(vehicles),
        orders_loaded=len(orders),
        delivered_orders=sum(
            order.status is OrderStatus.DELIVERED for order in orders
        ),
        active_telemetry_vehicles=sum(
            vehicle.last_gps_ping_at is not None for vehicle in vehicles
        ),
        message="Demo logistics scenario loaded successfully.",
    )
