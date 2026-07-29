import asyncio
from uuid import uuid4

import pytest
from fastapi import HTTPException, Request
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.v1.admin import list_available_drivers
from app.api.v1.driver import (
    _read_limited_pod_body,
    get_driver_route,
    update_driver_order_status,
)
from app.api.v1.orders import create_order, dispatch_order, update_order_status
from app.core.security import get_password_hash
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
from app.schemas import (
    DriverOrderStatus,
    DriverOrderStatusUpdate,
    OrderCreate,
    OrderDispatchRequest,
    OrderStatusUpdate,
)
from app.services.pod_storage import MAX_POD_BYTES, validate_pod_content
from app.services.region_matcher import regions_match


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


def test_region_matcher_maps_hcm_districts_to_operating_zones() -> None:
    assert regions_match("Huyện Hóc Môn", "northwest")
    assert regions_match("Quan 12, Ho Chi Minh City", "northwest")
    assert regions_match("Quan 10, Ho Chi Minh City", "central")
    assert regions_match("Thành phố Thủ Đức", "east")
    assert not regions_match("Quận 7", "northwest")
    assert not regions_match("Quan 6", "northwest")


def test_create_order_stays_pending_until_dispatcher_explicitly_assigns_it(
    db: Session,
) -> None:
    dispatcher = active_user(
        db,
        role=UserRole.DISPATCHER,
        email="dispatcher.region@test.vn",
    )
    driver = active_user(
        db,
        role=UserRole.DRIVER,
        email="driver.region@test.vn",
    )
    vehicle = Vehicle(
        license_plate="51D-REGION",
        capacity_kg=1000,
        driver_name=driver.full_name,
        driver_id=driver.id,
        status=VehicleStatus.IDLE,
        service_area="east",
    )
    db.add_all(
        [
            vehicle,
            Depot(
                name="Test Depot",
                address="Quan 12",
                latitude=10.86,
                longitude=106.65,
            ),
        ]
    )
    db.commit()

    payload = OrderCreate(
        order_code="REGION-001",
        customer_name="Khach Hang",
        address="Hoc Mon, Ho Chi Minh City",
        latitude=10.883,
        longitude=106.587,
        weight_kg=10,
        delivery_region="Huyện Hóc Môn",
    )

    created = create_order(payload=payload, db=db, _current_user=dispatcher)
    assert created.status is OrderStatus.PENDING
    assert created.assigned_vehicle_id is None
    assert created.stop_sequence is None
    db.refresh(vehicle)
    assert vehicle.status is VehicleStatus.IDLE

    with pytest.raises(HTTPException) as mismatch:
        dispatch_order(
            order_id=created.id,
            payload=OrderDispatchRequest(driver_id=driver.id),
            db=db,
            _current_user=dispatcher,
        )

    assert mismatch.value.status_code == 409
    assert mismatch.value.detail["code"] == "REGION_MISMATCH"

    assigned = dispatch_order(
        order_id=created.id,
        payload=OrderDispatchRequest(
            driver_id=driver.id,
            force_region_mismatch=True,
        ),
        db=db,
        _current_user=dispatcher,
    )
    assert assigned.assigned_vehicle_id == vehicle.id
    assert assigned.delivery_region == "Huyện Hóc Môn"
    assert assigned.status is OrderStatus.ASSIGNED
    assert assigned.route_batch_id is not None
    db.refresh(vehicle)
    assert vehicle.status is VehicleStatus.ON_ROUTE


def test_driver_route_excludes_completed_stops_from_previous_batches(
    db: Session,
) -> None:
    driver = active_user(
        db,
        role=UserRole.DRIVER,
        email="driver.current-batch@test.vn",
    )
    vehicle = Vehicle(
        license_plate="51D-BATCH",
        capacity_kg=800,
        driver_id=driver.id,
        driver_name=driver.full_name,
        status=VehicleStatus.ON_ROUTE,
    )
    db.add_all(
        [
            vehicle,
            Depot(
                name="Current Batch Depot",
                address="Quan 12",
                latitude=10.86,
                longitude=106.65,
            ),
        ]
    )
    db.flush()

    old_batch_id = uuid4()
    current_batch_id = uuid4()
    db.add_all(
        [
            Order(
                order_code="OLD-DELIVERED",
                customer_name="Old Customer",
                address="Quan 1",
                latitude=10.77,
                longitude=106.70,
                weight_kg=5,
                status=OrderStatus.DELIVERED,
                assigned_vehicle_id=vehicle.id,
                stop_sequence=1,
                route_batch_id=old_batch_id,
            ),
            Order(
                order_code="CURRENT-DELIVERED",
                customer_name="Current Customer One",
                address="Quan 3",
                latitude=10.78,
                longitude=106.68,
                weight_kg=5,
                status=OrderStatus.DELIVERED,
                assigned_vehicle_id=vehicle.id,
                stop_sequence=1,
                route_batch_id=current_batch_id,
            ),
            Order(
                order_code="CURRENT-ACTIVE",
                customer_name="Current Customer Two",
                address="Quan 5",
                latitude=10.76,
                longitude=106.67,
                weight_kg=5,
                status=OrderStatus.ASSIGNED,
                assigned_vehicle_id=vehicle.id,
                stop_sequence=2,
                route_batch_id=current_batch_id,
            ),
        ]
    )
    db.commit()

    route = get_driver_route(db=db, current_user=driver)

    assert route.total_orders == 2
    assert route.completed_orders == 1
    assert [stop.order_code for stop in route.stops] == [
        "CURRENT-DELIVERED",
        "CURRENT-ACTIVE",
    ]


def test_available_driver_list_includes_idle_or_no_active_order_vehicles(
    db: Session,
) -> None:
    dispatcher = active_user(
        db,
        role=UserRole.DISPATCHER,
        email="dispatcher.available@test.vn",
    )
    ready_driver = active_user(
        db,
        role=UserRole.DRIVER,
        email="ready.driver@test.vn",
    )
    busy_driver = active_user(
        db,
        role=UserRole.DRIVER,
        email="busy.driver@test.vn",
    )
    recovered_driver = active_user(
        db,
        role=UserRole.DRIVER,
        email="recovered.driver@test.vn",
    )
    busy_vehicle = Vehicle(
        license_plate="51D-BUSY",
        capacity_kg=1200,
        driver_id=busy_driver.id,
        driver_name=busy_driver.full_name,
        status=VehicleStatus.ON_ROUTE,
        service_area="east",
    )
    db.add_all(
        [
            Vehicle(
                license_plate="51D-READY",
                capacity_kg=800,
                driver_id=ready_driver.id,
                driver_name=ready_driver.full_name,
                status=VehicleStatus.IDLE,
                service_area="central",
            ),
            busy_vehicle,
            Vehicle(
                license_plate="51D-RECOVERED",
                capacity_kg=700,
                driver_id=recovered_driver.id,
                driver_name=recovered_driver.full_name,
                status=VehicleStatus.ON_ROUTE,
                service_area="west",
            ),
        ]
    )
    db.flush()
    db.add(
        Order(
            order_code="BUSY-001",
            customer_name="Busy Customer",
            address="Thu Duc",
            latitude=10.82,
            longitude=106.76,
            weight_kg=10,
            status=OrderStatus.ASSIGNED,
            assigned_vehicle_id=busy_vehicle.id,
            stop_sequence=1,
        )
    )
    db.commit()

    available = list_available_drivers(db=db, _current_user=dispatcher)

    assert {item.driver_id for item in available} == {
        ready_driver.id,
        recovered_driver.id,
    }
    assert busy_driver.id not in {item.driver_id for item in available}


def test_pod_content_validation_accepts_images_and_rejects_disguised_files() -> None:
    jpeg = b"\xff\xd8\xff" + b"safe-image"
    assert validate_pod_content(jpeg, "image/jpeg") == ".jpg"

    with pytest.raises(ValueError, match="content"):
        validate_pod_content(b"<script>alert(1)</script>", "image/jpeg")


def test_pod_stream_rejects_oversized_upload_without_content_length() -> None:
    messages = iter(
        [
            {
                "type": "http.request",
                "body": b"x" * MAX_POD_BYTES,
                "more_body": True,
            },
            {
                "type": "http.request",
                "body": b"x",
                "more_body": False,
            },
        ]
    )

    async def receive() -> dict[str, object]:
        return next(messages)

    request = Request(
        {"type": "http", "method": "POST", "headers": []},
        receive,
    )
    with pytest.raises(HTTPException) as oversized:
        asyncio.run(_read_limited_pod_body(request))

    assert oversized.value.status_code == 413


def test_driver_delivery_update_enforces_pod_and_failure_reason(
    db: Session,
) -> None:
    driver = active_user(
        db,
        role=UserRole.DRIVER,
        email="driver.pod@test.vn",
    )
    vehicle = Vehicle(
        license_plate="51D-POD",
        capacity_kg=800,
        driver_id=driver.id,
        driver_name=driver.full_name,
        status=VehicleStatus.ON_ROUTE,
    )
    db.add(vehicle)
    db.flush()
    order = Order(
        order_code="POD-001",
        customer_name="Khach Hang POD",
        address="Quan 1, Ho Chi Minh City",
        latitude=10.7769,
        longitude=106.7009,
        weight_kg=5,
        status=OrderStatus.DELIVERING,
        assigned_vehicle_id=vehicle.id,
        stop_sequence=1,
    )
    db.add(order)
    db.commit()

    with pytest.raises(HTTPException, match="Proof of delivery"):
        update_driver_order_status(
            order_id=order.id,
            payload=DriverOrderStatusUpdate(
                status=DriverOrderStatus.DELIVERED,
            ),
            db=db,
            current_user=driver,
        )

    with pytest.raises(HTTPException, match="Failure reason"):
        update_driver_order_status(
            order_id=order.id,
            payload=DriverOrderStatusUpdate(
                status=DriverOrderStatus.FAILED,
            ),
            db=db,
            current_user=driver,
        )

    updated = update_driver_order_status(
        order_id=order.id,
        payload=DriverOrderStatusUpdate(
            status=DriverOrderStatus.DELIVERED,
            delivery_note="Da giao cho bao ve",
            pod_url="http://localhost:8000/uploads/pod/proof.jpg",
        ),
        db=db,
        current_user=driver,
    )

    assert updated.status is OrderStatus.DELIVERED
    assert updated.pod_url == "http://localhost:8000/uploads/pod/proof.jpg"
    assert updated.pod_uploaded_at is not None
    db.refresh(vehicle)
    assert vehicle.status is VehicleStatus.IDLE


def test_vehicle_stays_on_route_while_another_active_stop_remains(
    db: Session,
) -> None:
    driver = active_user(
        db,
        role=UserRole.DRIVER,
        email="driver.multi-stop@test.vn",
    )
    vehicle = Vehicle(
        license_plate="51D-MULTI",
        capacity_kg=800,
        driver_id=driver.id,
        driver_name=driver.full_name,
        status=VehicleStatus.ON_ROUTE,
    )
    db.add(vehicle)
    db.flush()
    delivered_stop = Order(
        order_code="MULTI-001",
        customer_name="Stop One",
        address="Quan 1",
        latitude=10.77,
        longitude=106.70,
        weight_kg=5,
        status=OrderStatus.DELIVERING,
        assigned_vehicle_id=vehicle.id,
        stop_sequence=1,
    )
    remaining_stop = Order(
        order_code="MULTI-002",
        customer_name="Stop Two",
        address="Quan 3",
        latitude=10.78,
        longitude=106.68,
        weight_kg=5,
        status=OrderStatus.ASSIGNED,
        assigned_vehicle_id=vehicle.id,
        stop_sequence=2,
    )
    db.add_all([delivered_stop, remaining_stop])
    db.commit()

    update_driver_order_status(
        order_id=delivered_stop.id,
        payload=DriverOrderStatusUpdate(
            status=DriverOrderStatus.DELIVERED,
            pod_url="http://localhost:8000/uploads/pod/multi.jpg",
        ),
        db=db,
        current_user=driver,
    )

    db.refresh(vehicle)
    assert vehicle.status is VehicleStatus.ON_ROUTE


def test_dispatcher_terminal_override_releases_the_vehicle(
    db: Session,
) -> None:
    dispatcher = active_user(
        db,
        role=UserRole.DISPATCHER,
        email="dispatcher.complete@test.vn",
    )
    driver = active_user(
        db,
        role=UserRole.DRIVER,
        email="driver.complete@test.vn",
    )
    vehicle = Vehicle(
        license_plate="51D-COMPLETE",
        capacity_kg=800,
        driver_id=driver.id,
        driver_name=driver.full_name,
        status=VehicleStatus.ON_ROUTE,
    )
    db.add(vehicle)
    db.flush()
    order = Order(
        order_code="COMPLETE-001",
        customer_name="Complete Customer",
        address="Quan 1",
        latitude=10.77,
        longitude=106.70,
        weight_kg=5,
        status=OrderStatus.DELIVERING,
        assigned_vehicle_id=vehicle.id,
        stop_sequence=1,
    )
    db.add(order)
    db.commit()

    update_order_status(
        order_id=order.id,
        payload=OrderStatusUpdate(status=OrderStatus.DELIVERED),
        db=db,
        _current_user=dispatcher,
    )

    db.refresh(vehicle)
    assert vehicle.status is VehicleStatus.IDLE
