from datetime import datetime, timezone
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.v1.orders import create_order, get_public_tracking, public_router
from app.core.security import get_current_user, get_password_hash
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
from app.db.session import get_db
from app.schemas import OrderCreate
from app.services.public_tracking import (
    generate_tracking_token,
    mask_customer_name,
    mask_phone_number,
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


def test_tracking_tokens_are_random_url_safe_and_unique() -> None:
    tokens = {generate_tracking_token() for _ in range(50)}

    assert len(tokens) == 50
    assert all(32 <= len(token) <= 64 for token in tokens)
    assert all(token.replace("-", "").replace("_", "").isalnum() for token in tokens)


def test_public_masking_does_not_expose_raw_customer_pii() -> None:
    assert mask_customer_name("Nguyễn Văn A") == "Nguyễn V. A"
    assert mask_customer_name("An") == "A."
    assert mask_phone_number("0912345678") == "091****678"
    assert mask_phone_number(None) is None


def test_order_tracking_token_is_non_nullable_and_unique() -> None:
    # SQLAlchemy metadata is the portable source of truth for SQLite/PostgreSQL tests.
    column = Order.__table__.c.tracking_token
    assert column.nullable is False
    assert column.type.length == 64
    assert column.unique is True


def test_create_order_generates_tracking_token(db: Session) -> None:
    dispatcher = User(
        email="public.tracking.dispatcher@test.vn",
        hashed_password=get_password_hash("123456"),
        full_name="Public Tracking Dispatcher",
        role=UserRole.DISPATCHER,
        status=UserStatus.ACTIVE,
    )
    db.add(dispatcher)
    db.commit()

    order = create_order(
        payload=OrderCreate(
            order_code="PUBLIC-TRACKING-001",
            customer_name="Nguyễn Văn A",
            customer_phone="0912345678",
            address="Quận 1, TP.HCM",
            latitude=10.7769,
            longitude=106.7009,
            weight_kg=8,
        ),
        db=db,
        _current_user=dispatcher,
    )

    assert 32 <= len(order.tracking_token) <= 64


def test_public_tracking_returns_masked_data_and_counts_only_prior_active_stops(
    db: Session,
) -> None:
    depot = Depot(
        name="Kho Quận 12",
        address="Quận 12, TP.HCM",
        latitude=10.8632,
        longitude=106.6535,
    )
    driver = User(
        email="public.tracking.driver@test.vn",
        hashed_password=get_password_hash("123456"),
        full_name="Huynh Tai",
        phone_number="0901234567",
        role=UserRole.DRIVER,
        status=UserStatus.ACTIVE,
    )
    db.add_all([depot, driver])
    db.flush()
    vehicle = Vehicle(
        license_plate="51D-12003",
        capacity_kg=1200,
        vehicle_type="TRUCK",
        driver_name=driver.full_name,
        driver_id=driver.id,
        status=VehicleStatus.ON_ROUTE,
    )
    db.add(vehicle)
    db.flush()
    batch_id = uuid4()
    now = datetime.now(timezone.utc)
    current = Order(
        order_code="PUBLIC-TRACKING-CURRENT",
        customer_name="Nguyễn Văn A",
        customer_phone="0912345678",
        address="123 Nguyễn Huệ, Quận 1, TP.HCM",
        latitude=10.7769,
        longitude=106.7009,
        weight_kg=15,
        status=OrderStatus.DELIVERING,
        status_updated_at=now,
        assigned_vehicle_id=vehicle.id,
        route_batch_id=batch_id,
        stop_sequence=3,
    )
    orders = [
        current,
        Order(
            order_code="PUBLIC-TRACKING-PRIOR-ACTIVE",
            customer_name="Prior Active",
            address="Gò Vấp",
            latitude=10.82,
            longitude=106.68,
            weight_kg=5,
            status=OrderStatus.ASSIGNED,
            assigned_vehicle_id=vehicle.id,
            route_batch_id=batch_id,
            stop_sequence=1,
        ),
        Order(
            order_code="PUBLIC-TRACKING-PRIOR-DONE",
            customer_name="Prior Done",
            address="Phú Nhuận",
            latitude=10.80,
            longitude=106.67,
            weight_kg=5,
            status=OrderStatus.DELIVERED,
            assigned_vehicle_id=vehicle.id,
            route_batch_id=batch_id,
            stop_sequence=2,
        ),
        Order(
            order_code="PUBLIC-TRACKING-LATER",
            customer_name="Later Active",
            address="Thủ Đức",
            latitude=10.84,
            longitude=106.76,
            weight_kg=5,
            status=OrderStatus.ASSIGNED,
            assigned_vehicle_id=vehicle.id,
            route_batch_id=batch_id,
            stop_sequence=4,
        ),
    ]
    db.add_all(orders)
    db.commit()

    response = get_public_tracking(current.tracking_token, db=db)

    assert response.order.order_code == current.order_code
    assert response.order.customer_name_masked == "Nguyễn V. A"
    assert response.order.customer_phone_masked == "091****678"
    assert response.order.customer_name_masked != current.customer_name
    assert response.order.customer_phone_masked != current.customer_phone
    assert response.depot.id == depot.id
    assert response.driver is not None
    assert response.driver.driver_name == driver.full_name
    assert response.driver.driver_phone == "090****567"
    assert response.driver.license_plate == vehicle.license_plate
    assert response.stops_remaining_before == 1
    assert response.route_batch_id == batch_id
    assert response.estimated_arrival_minutes == 30


def test_public_tracking_uses_a_generic_404_for_unknown_token(db: Session) -> None:
    with pytest.raises(HTTPException) as missing:
        get_public_tracking("unknown-tracking-token", db=db)

    assert missing.value.status_code == 404
    assert missing.value.detail == "Tracking information not found"


def test_public_tracking_route_has_no_authentication_dependency() -> None:
    tracking_route = next(
        route
        for route in public_router.routes
        if getattr(route, "path", "") == "/public/track/{tracking_token}"
    )
    dependency_calls = {
        dependency.call for dependency in tracking_route.dependant.dependencies
    }

    assert get_db in dependency_calls
    assert get_current_user not in dependency_calls
