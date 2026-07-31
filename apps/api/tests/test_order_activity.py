import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException, Request
from sqlalchemy import create_engine, inspect, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.v1.orders import create_order, get_order_activity, update_order_status
from app.api.v1 import driver as driver_api
from app.core.security import get_password_hash
from app.db.base import Base
from app.db.models import (
    Order,
    OrderActivityLog,
    OrderStatus,
    User,
    UserRole,
    UserStatus,
    Vehicle,
    VehicleStatus,
)
from app.schemas import OrderCreate, OrderStatusUpdate
from app.services.activity_logger import log_order_activity


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


def active_user(db: Session, *, role: UserRole, email: str) -> User:
    user = User(
        email=email,
        hashed_password=get_password_hash("123456"),
        full_name=email.split("@")[0].replace(".", " ").title(),
        role=role,
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_activity_model_cascades_when_order_is_deleted(db: Session) -> None:
    foreign_keys = inspect(db.bind).get_foreign_keys("order_activity_logs")

    assert foreign_keys[0]["referred_table"] == "orders"
    assert foreign_keys[0]["options"]["ondelete"] == "CASCADE"


def test_activity_logger_captures_actor_and_status_transition(db: Session) -> None:
    dispatcher = active_user(
        db,
        role=UserRole.DISPATCHER,
        email="activity.dispatcher@test.vn",
    )
    order = Order(
        order_code="ACTIVITY-SERVICE-001",
        customer_name="Activity Customer",
        address="Quan 1",
        latitude=10.77,
        longitude=106.70,
        weight_kg=8,
        status=OrderStatus.PENDING,
    )
    db.add(order)
    db.flush()

    log_order_activity(
        db,
        order_id=order.id,
        action="STATUS_CHANGED",
        actor=dispatcher,
        old_status="PENDING",
        new_status="ASSIGNED",
        detail="Assigned from test",
    )
    db.commit()

    activity = db.scalar(select(OrderActivityLog))
    assert activity is not None
    assert activity.order_id == order.id
    assert activity.actor_id == dispatcher.id
    assert activity.actor_name == dispatcher.full_name
    assert activity.actor_role == UserRole.DISPATCHER.value
    assert activity.old_status == "PENDING"
    assert activity.new_status == "ASSIGNED"


def test_create_and_status_update_record_activity_in_the_same_flow(
    db: Session,
) -> None:
    dispatcher = active_user(
        db,
        role=UserRole.DISPATCHER,
        email="activity.create@test.vn",
    )
    order = create_order(
        payload=OrderCreate(
            order_code="ACTIVITY-CREATE-001",
            customer_name="Created Customer",
            address="Quan 3",
            latitude=10.78,
            longitude=106.68,
            weight_kg=5,
        ),
        db=db,
        _current_user=dispatcher,
    )

    update_order_status(
        order_id=order.id,
        payload=OrderStatusUpdate(
            status=OrderStatus.FAILED,
            failure_reason="Khach hen lai",
        ),
        db=db,
        _current_user=dispatcher,
    )

    activities = list(
        db.scalars(
            select(OrderActivityLog)
            .where(OrderActivityLog.order_id == order.id)
            .order_by(OrderActivityLog.created_at, OrderActivityLog.id)
        ).all()
    )
    assert [activity.action for activity in activities] == [
        "CREATED",
        "STATUS_CHANGED",
    ]
    assert activities[0].new_status == "PENDING"
    assert activities[1].old_status == "PENDING"
    assert activities[1].new_status == "FAILED"


def test_activity_endpoint_returns_newest_first_and_hides_other_drivers_orders(
    db: Session,
) -> None:
    dispatcher = active_user(
        db,
        role=UserRole.DISPATCHER,
        email="activity.viewer@test.vn",
    )
    driver = active_user(
        db,
        role=UserRole.DRIVER,
        email="activity.driver@test.vn",
    )
    vehicle = Vehicle(
        license_plate="51D-ACTIVITY",
        capacity_kg=800,
        driver_id=driver.id,
        driver_name=driver.full_name,
        status=VehicleStatus.ON_ROUTE,
    )
    db.add(vehicle)
    db.flush()
    owned_order = Order(
        order_code="ACTIVITY-OWNED",
        customer_name="Owned Customer",
        address="Quan 1",
        latitude=10.77,
        longitude=106.70,
        weight_kg=5,
        status=OrderStatus.ASSIGNED,
        assigned_vehicle_id=vehicle.id,
    )
    other_order = Order(
        order_code="ACTIVITY-OTHER",
        customer_name="Other Customer",
        address="Quan 7",
        latitude=10.73,
        longitude=106.72,
        weight_kg=5,
        status=OrderStatus.PENDING,
    )
    db.add_all([owned_order, other_order])
    db.flush()
    older = OrderActivityLog(
        order_id=owned_order.id,
        action="CREATED",
        new_status="PENDING",
        created_at=datetime.now(timezone.utc) - timedelta(minutes=5),
    )
    newer = OrderActivityLog(
        order_id=owned_order.id,
        action="ASSIGNED",
        old_status="PENDING",
        new_status="ASSIGNED",
        actor_id=dispatcher.id,
        actor_name=dispatcher.full_name,
        actor_role=dispatcher.role.value,
        created_at=datetime.now(timezone.utc),
    )
    db.add_all([older, newer])
    db.commit()

    response = get_order_activity(
        order_id=owned_order.id,
        db=db,
        current_user=driver,
    )
    assert response.order_code == owned_order.order_code
    assert [activity.action for activity in response.activities] == [
        "ASSIGNED",
        "CREATED",
    ]

    with pytest.raises(HTTPException) as forbidden:
        get_order_activity(
            order_id=other_order.id,
            db=db,
            current_user=driver,
        )
    assert forbidden.value.status_code == 404


def test_pod_upload_records_driver_activity(
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    driver = active_user(
        db,
        role=UserRole.DRIVER,
        email="activity.pod@test.vn",
    )
    vehicle = Vehicle(
        license_plate="51D-POD-ACTIVITY",
        capacity_kg=800,
        driver_id=driver.id,
        driver_name=driver.full_name,
        status=VehicleStatus.ON_ROUTE,
    )
    db.add(vehicle)
    db.flush()
    order = Order(
        order_code="ACTIVITY-POD-001",
        customer_name="POD Customer",
        address="Quan 1",
        latitude=10.77,
        longitude=106.70,
        weight_kg=5,
        status=OrderStatus.DELIVERING,
        assigned_vehicle_id=vehicle.id,
    )
    db.add(order)
    db.commit()

    body = b"\xff\xd8\xff" + b"activity-pod-image"
    messages = iter(
        [{"type": "http.request", "body": body, "more_body": False}]
    )

    async def receive() -> dict[str, object]:
        return next(messages)

    request = Request(
        {
            "type": "http",
            "method": "POST",
            "headers": [
                (b"content-type", b"image/jpeg"),
                (b"content-length", str(len(body)).encode()),
            ],
        },
        receive,
    )
    monkeypatch.setattr(driver_api, "POD_UPLOAD_DIR", tmp_path)
    monkeypatch.setattr(driver_api, "POD_PUBLIC_BASE_URL", "http://testserver")

    response = asyncio.run(
        driver_api.upload_order_pod(
            order_id=order.id,
            request=request,
            db=db,
            current_user=driver,
        )
    )

    assert response.pod_url.startswith("http://testserver/uploads/pod/")
    activity = db.scalar(
        select(OrderActivityLog).where(
            OrderActivityLog.order_id == order.id,
            OrderActivityLog.action == "POD_UPLOADED",
        )
    )
    assert activity is not None
    assert activity.actor_id == driver.id
