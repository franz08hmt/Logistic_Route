from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.v1.admin import list_vehicle_telemetry
from app.api.v1.driver import update_driver_telemetry
from app.db.base import Base
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
from app.schemas import DriverTelemetryPing
from app.services.telemetry import calculate_perpendicular_distance


@pytest.fixture
def db() -> Session:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def _active_driver_route(db: Session) -> tuple[User, Vehicle, Order]:
    driver = User(
        email="telemetry.driver@test.vn",
        hashed_password="test-hash",
        full_name="Telemetry Driver",
        role=UserRole.DRIVER,
        status=UserStatus.ACTIVE,
    )
    depot = Depot(
        name="Kho telemetry",
        address="Quan 12, Ho Chi Minh City",
        latitude=10.8632,
        longitude=106.6535,
    )
    db.add_all([driver, depot])
    db.flush()
    vehicle = Vehicle(
        license_plate="51D-TELEMETRY",
        capacity_kg=1_000,
        driver_name=driver.full_name,
        driver_id=driver.id,
        status=VehicleStatus.ON_ROUTE,
    )
    db.add(vehicle)
    db.flush()
    batch_id = uuid4()
    completed = Order(
        order_code="TEL-001",
        customer_name="Completed customer",
        address="Previous stop",
        latitude=10.8500,
        longitude=106.6600,
        weight_kg=10,
        status=OrderStatus.DELIVERED,
        assigned_vehicle_id=vehicle.id,
        route_batch_id=batch_id,
        stop_sequence=1,
    )
    next_stop = Order(
        order_code="TEL-002",
        customer_name="Next customer",
        address="Next stop address",
        latitude=10.8300,
        longitude=106.6800,
        weight_kg=15,
        status=OrderStatus.ASSIGNED,
        assigned_vehicle_id=vehicle.id,
        route_batch_id=batch_id,
        stop_sequence=2,
    )
    db.add_all([completed, next_stop])
    db.commit()
    return driver, vehicle, next_stop


def test_perpendicular_distance_uses_bounded_route_segment() -> None:
    on_segment = calculate_perpendicular_distance(
        (10.0, 106.005),
        (10.0, 106.0),
        (10.0, 106.01),
    )
    beyond_segment = calculate_perpendicular_distance(
        (10.0, 106.02),
        (10.0, 106.0),
        (10.0, 106.01),
    )

    assert on_segment == pytest.approx(0, abs=0.001)
    assert 1.0 < beyond_segment < 1.2


def test_driver_telemetry_updates_vehicle_and_detects_deviation(db: Session) -> None:
    driver, vehicle, next_stop = _active_driver_route(db)

    response = update_driver_telemetry(
        DriverTelemetryPing(
            latitude=10.9000,
            longitude=106.7600,
            speed_kmh=32,
        ),
        db=db,
        current_user=driver,
    )

    db.refresh(vehicle)
    assert response.vehicle_id == vehicle.id
    assert response.next_stop_address == next_stop.address
    assert response.next_stop_sequence == 2
    assert response.route_deviation_status == "OFF_ROUTE_WARNING"
    assert vehicle.current_latitude == pytest.approx(10.9000)
    assert vehicle.current_longitude == pytest.approx(106.7600)
    assert vehicle.current_speed_kmh == pytest.approx(32)
    assert vehicle.last_gps_ping_at is not None


def test_driver_telemetry_marks_nearby_ping_on_route(db: Session) -> None:
    driver, _, _ = _active_driver_route(db)

    response = update_driver_telemetry(
        DriverTelemetryPing(
            latitude=10.8400,
            longitude=106.6700,
            speed_kmh=18,
        ),
        db=db,
        current_user=driver,
    )

    assert response.route_deviation_status == "ON_ROUTE"


def test_admin_telemetry_lists_on_route_and_recent_vehicles(db: Session) -> None:
    driver, active_vehicle, _ = _active_driver_route(db)
    now = datetime.now(timezone.utc)
    active_vehicle.current_latitude = 10.84
    active_vehicle.current_longitude = 106.67
    active_vehicle.current_speed_kmh = 20
    active_vehicle.last_gps_ping_at = now
    active_vehicle.route_deviation_status = "ON_ROUTE"
    recent_idle = Vehicle(
        license_plate="51D-RECENT",
        capacity_kg=500,
        status=VehicleStatus.IDLE,
        current_latitude=10.78,
        current_longitude=106.70,
        last_gps_ping_at=now - timedelta(minutes=30),
    )
    stale_idle = Vehicle(
        license_plate="51D-STALE",
        capacity_kg=500,
        status=VehicleStatus.IDLE,
        current_latitude=10.79,
        current_longitude=106.71,
        last_gps_ping_at=now - timedelta(hours=2),
    )
    db.add_all([recent_idle, stale_idle])
    db.commit()

    response = list_vehicle_telemetry(db=db, _current_user=driver)

    plates = {item.license_plate for item in response.vehicles}
    assert active_vehicle.license_plate in plates
    assert recent_idle.license_plate in plates
    assert stale_idle.license_plate not in plates
    active_item = next(
        item for item in response.vehicles if item.vehicle_id == active_vehicle.id
    )
    assert active_item.next_stop_address == "Next stop address"
    assert active_item.next_stop_sequence == 2
