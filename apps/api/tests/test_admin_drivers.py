from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.v1.admin import list_drivers
from app.core.security import get_password_hash
from app.db.base import Base
from app.db.models import (
    Order,
    OrderStatus,
    User,
    UserRole,
    UserStatus,
    Vehicle,
    VehicleStatus,
)
from app.main import app


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


def _user(
    db: Session,
    *,
    email: str,
    role: UserRole,
    status: UserStatus = UserStatus.ACTIVE,
) -> User:
    user = User(
        email=email,
        hashed_password=get_password_hash("123456"),
        full_name=email.split("@")[0].replace(".", " ").title(),
        role=role,
        status=status,
    )
    db.add(user)
    db.flush()
    return user


def test_admin_drivers_returns_vehicle_and_current_performance(
    db: Session,
) -> None:
    dispatcher = _user(
        db,
        email="dispatcher@drivers.test",
        role=UserRole.DISPATCHER,
    )
    active_driver = _user(
        db,
        email="active.driver@drivers.test",
        role=UserRole.DRIVER,
    )
    pending_driver = _user(
        db,
        email="pending.driver@drivers.test",
        role=UserRole.DRIVER,
        status=UserStatus.PENDING_APPROVAL,
    )
    vehicle = Vehicle(
        license_plate="51D-DRIVERS",
        capacity_kg=950,
        vehicle_type="VAN",
        driver_id=active_driver.id,
        driver_name=active_driver.full_name,
        status=VehicleStatus.ON_ROUTE,
        service_area="Tay Bac TP.HCM",
    )
    db.add(vehicle)
    db.flush()

    now = datetime.now(timezone.utc)
    db.add_all(
        [
            Order(
                order_code="DRIVER-ACTIVE",
                customer_name="Active Customer",
                address="Quan 12",
                latitude=10.86,
                longitude=106.65,
                weight_kg=10,
                status=OrderStatus.ASSIGNED,
                assigned_vehicle_id=vehicle.id,
                status_updated_at=now,
            ),
            Order(
                order_code="DRIVER-DELIVERED-TODAY",
                customer_name="Delivered Customer",
                address="Quan 1",
                latitude=10.77,
                longitude=106.70,
                weight_kg=5,
                status=OrderStatus.DELIVERED,
                assigned_vehicle_id=vehicle.id,
                status_updated_at=now,
            ),
            Order(
                order_code="DRIVER-FAILED-YESTERDAY",
                customer_name="Failed Customer",
                address="Quan 3",
                latitude=10.78,
                longitude=106.68,
                weight_kg=5,
                status=OrderStatus.FAILED,
                assigned_vehicle_id=vehicle.id,
                status_updated_at=now - timedelta(days=1),
            ),
        ]
    )
    db.commit()

    rows = list_drivers(
        search=None,
        account_status=None,
        has_vehicle=None,
        db=db,
        _current_user=dispatcher,
    )

    assert [row.id for row in rows] == [active_driver.id, pending_driver.id]
    active = rows[0]
    assert active.vehicle_id == vehicle.id
    assert active.license_plate == "51D-DRIVERS"
    assert active.vehicle_type == "VAN"
    assert active.vehicle_status is VehicleStatus.ON_ROUTE
    assert active.active_orders_count == 1
    assert active.delivered_today_count == 1
    assert active.failed_today_count == 0


def test_admin_drivers_supports_search_status_and_vehicle_filters(
    db: Session,
) -> None:
    dispatcher = _user(
        db,
        email="dispatcher.filters@test.vn",
        role=UserRole.DISPATCHER,
    )
    assigned = _user(
        db,
        email="assigned.driver@test.vn",
        role=UserRole.DRIVER,
    )
    pending = _user(
        db,
        email="pending.driver@test.vn",
        role=UserRole.DRIVER,
        status=UserStatus.PENDING_APPROVAL,
    )
    db.add(
        Vehicle(
            license_plate="51D-FILTER",
            capacity_kg=800,
            driver_id=assigned.id,
            driver_name=assigned.full_name,
            status=VehicleStatus.IDLE,
        )
    )
    db.commit()

    search_rows = list_drivers(
        search="assigned.driver",
        account_status=None,
        has_vehicle=None,
        db=db,
        _current_user=dispatcher,
    )
    status_rows = list_drivers(
        search=None,
        account_status=UserStatus.PENDING_APPROVAL,
        has_vehicle=None,
        db=db,
        _current_user=dispatcher,
    )
    unassigned_rows = list_drivers(
        search=None,
        account_status=None,
        has_vehicle=False,
        db=db,
        _current_user=dispatcher,
    )

    assert [row.id for row in search_rows] == [assigned.id]
    assert [row.id for row in status_rows] == [pending.id]
    assert [row.id for row in unassigned_rows] == [pending.id]


def test_admin_drivers_endpoint_is_exposed_in_openapi() -> None:
    operation = app.openapi()["paths"]["/api/v1/admin/drivers"]["get"]
    schema = app.openapi()["components"]["schemas"]["DriverDetailRead"]

    assert operation["tags"] == ["admin"]
    assert "vehicle_status" in schema["properties"]
    assert "active_orders_count" in schema["properties"]
    assert "delivered_today_count" in schema["properties"]
