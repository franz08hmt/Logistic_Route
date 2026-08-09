from datetime import datetime, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.v1.admin import list_available_drivers, list_vehicle_telemetry
from app.api.v1.orders import list_orders
from app.api.v1.overview import get_overview
from app.api.v1.vehicles import list_vehicles
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


def test_operational_reads_use_default_or_explicit_depot(db: Session) -> None:
    dispatcher = User(
        email="dispatcher@scope.test",
        hashed_password="unused",
        full_name="Scope Dispatcher",
        role=UserRole.DISPATCHER,
        status=UserStatus.ACTIVE,
    )
    sgn_driver = User(
        email="sgn.driver@scope.test",
        hashed_password="unused",
        full_name="SGN Driver",
        role=UserRole.DRIVER,
        status=UserStatus.ACTIVE,
    )
    han_driver = User(
        email="han.driver@scope.test",
        hashed_password="unused",
        full_name="HAN Driver",
        role=UserRole.DRIVER,
        status=UserStatus.ACTIVE,
    )
    sgn = Depot(
        code="HUB-SGN",
        name="Southern Hub",
        city="TP. Hồ Chí Minh",
        address="District 12",
        latitude=10.8671,
        longitude=106.6412,
        is_default=True,
    )
    han = Depot(
        code="HUB-HAN",
        name="Northern Hub",
        city="Hà Nội",
        address="Long Biên",
        latitude=21.0362,
        longitude=105.9015,
        is_default=False,
    )
    db.add_all([dispatcher, sgn_driver, han_driver, sgn, han])
    db.flush()

    sgn_vehicle = Vehicle(
        depot_id=sgn.id,
        license_plate="51D-SCOPE",
        capacity_kg=1000,
        driver_id=sgn_driver.id,
        driver_name=sgn_driver.full_name,
        status=VehicleStatus.IDLE,
    )
    han_vehicle = Vehicle(
        depot_id=han.id,
        license_plate="29H-SCOPE",
        capacity_kg=1200,
        driver_id=han_driver.id,
        driver_name=han_driver.full_name,
        status=VehicleStatus.ON_ROUTE,
        current_latitude=21.03,
        current_longitude=105.9,
        last_gps_ping_at=datetime.now(timezone.utc),
    )
    db.add_all([sgn_vehicle, han_vehicle])
    db.flush()
    db.add_all(
        [
            Order(
                depot_id=sgn.id,
                order_code="SGN-ORDER",
                customer_name="Southern Customer",
                address="HCMC",
                latitude=10.77,
                longitude=106.7,
                weight_kg=10,
                status=OrderStatus.PENDING,
            ),
            Order(
                depot_id=han.id,
                order_code="HAN-ORDER",
                customer_name="Northern Customer",
                address="Hanoi",
                latitude=21.02,
                longitude=105.85,
                weight_kg=20,
                status=OrderStatus.ASSIGNED,
                assigned_vehicle_id=han_vehicle.id,
                stop_sequence=1,
            ),
        ]
    )
    db.commit()

    default_orders = list_orders(
        depot_id=None,
        db=db,
        _current_user=dispatcher,
    )
    northern_orders = list_orders(
        depot_id=han.id,
        db=db,
        _current_user=dispatcher,
    )
    northern_vehicles = list_vehicles(
        depot_id=han.id,
        db=db,
        _current_user=dispatcher,
    )
    northern_overview = get_overview(depot_id=han.id, db=db)
    available_sgn = list_available_drivers(
        depot_id=sgn.id,
        db=db,
        _current_user=dispatcher,
    )
    northern_telemetry = list_vehicle_telemetry(
        depot_id=han.id,
        db=db,
        _current_user=dispatcher,
    )

    assert [order.order_code for order in default_orders] == ["SGN-ORDER"]
    assert [order.order_code for order in northern_orders] == ["HAN-ORDER"]
    assert [vehicle.license_plate for vehicle in northern_vehicles] == ["29H-SCOPE"]
    assert northern_overview.active_orders_count == 1
    assert northern_overview.vehicles_count == 1
    assert [driver.full_name for driver in available_sgn] == ["SGN Driver"]
    assert [item.license_plate for item in northern_telemetry.vehicles] == [
        "29H-SCOPE"
    ]
