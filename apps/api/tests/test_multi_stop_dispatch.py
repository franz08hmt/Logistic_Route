from uuid import uuid4

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.security import get_password_hash
from app.db.base import Base
from app.db.models import (
    Depot,
    Order,
    OrderActivityLog,
    OrderStatus,
    User,
    UserRole,
    UserStatus,
    Vehicle,
    VehicleStatus,
)
from app.main import app
from app.services.dispatch_optimization import (
    MultiStopDispatchError,
    dispatch_optimized_route,
)
from core_engine.solver import Route, Stop, VRPOutput


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


def _active_driver_with_vehicle(db: Session) -> tuple[User, Vehicle]:
    driver = User(
        email="multi.stop.driver@test.vn",
        hashed_password=get_password_hash("123456"),
        full_name="Multi Stop Driver",
        role=UserRole.DRIVER,
        status=UserStatus.ACTIVE,
    )
    db.add(driver)
    db.flush()
    vehicle = Vehicle(
        license_plate="51D-MULTI-STOP",
        capacity_kg=1000,
        driver_name=driver.full_name,
        driver_id=driver.id,
        status=VehicleStatus.IDLE,
        service_area="central",
    )
    db.add(vehicle)
    db.commit()
    return driver, vehicle


def test_multi_stop_dispatch_persists_solver_order_in_one_batch(
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    driver, vehicle = _active_driver_with_vehicle(db)
    depot = Depot(
        name="Kho Quan 12",
        address="Quan 12, Ho Chi Minh City",
        latitude=10.8632,
        longitude=106.6535,
    )
    first = Order(
        order_code="MULTI-DISPATCH-001",
        customer_name="Customer One",
        address="Quan 1",
        latitude=10.7769,
        longitude=106.7009,
        weight_kg=10,
        status=OrderStatus.PENDING,
    )
    second = Order(
        order_code="MULTI-DISPATCH-002",
        customer_name="Customer Two",
        address="Quan 3",
        latitude=10.784,
        longitude=106.684,
        weight_kg=20,
        status=OrderStatus.PENDING,
    )
    db.add_all([depot, first, second])
    db.commit()

    class _StubSolver:
        def __init__(self, data: object, time_limit_seconds: int) -> None:
            assert len(data.vehicles) == 1  # type: ignore[attr-defined]
            assert len(data.orders) == 2  # type: ignore[attr-defined]
            assert time_limit_seconds == 15

        def solve(self) -> VRPOutput:
            return VRPOutput(
                status="OPTIMAL",
                total_distance_km=21.5,
                total_duration_mins=64.5,
                unassigned_orders=[],
                routes=[
                    Route(
                        vehicle_id=str(vehicle.id),
                        license_plate=vehicle.license_plate,
                        total_weight_kg=30,
                        distance_km=21.5,
                        stops=[
                            Stop(
                                stop_sequence=1,
                                order_id=str(second.id),
                                address=second.address,
                                latitude=second.latitude,
                                longitude=second.longitude,
                            ),
                            Stop(
                                stop_sequence=2,
                                order_id=str(first.id),
                                address=first.address,
                                latitude=first.latitude,
                                longitude=first.longitude,
                            ),
                        ],
                    )
                ],
            )

    monkeypatch.setattr(
        "app.services.dispatch_optimization.VRPSolver",
        _StubSolver,
    )

    run = dispatch_optimized_route(
        db,
        order_ids=[first.id, second.id],
        driver_id=driver.id,
    )

    db.refresh(first)
    db.refresh(second)
    db.refresh(vehicle)
    assert run.route_batch_id == first.route_batch_id == second.route_batch_id
    assert (second.stop_sequence, first.stop_sequence) == (1, 2)
    assert first.status is OrderStatus.ASSIGNED
    assert second.status is OrderStatus.ASSIGNED
    assert first.assigned_vehicle_id == vehicle.id
    assert second.assigned_vehicle_id == vehicle.id
    assert vehicle.status is VehicleStatus.ON_ROUTE
    activities = list(
        db.scalars(
            select(OrderActivityLog).order_by(OrderActivityLog.order_id)
        ).all()
    )
    assert len(activities) == 2
    assert {activity.order_id for activity in activities} == {first.id, second.id}
    assert {activity.action for activity in activities} == {"ASSIGNED"}
    assert all(activity.detail == "Batch optimization" for activity in activities)


def test_multi_stop_dispatch_rejects_non_pending_orders_without_partial_changes(
    db: Session,
) -> None:
    driver, vehicle = _active_driver_with_vehicle(db)
    db.add(
        Depot(
            name="Kho Quan 12",
            address="Quan 12",
            latitude=10.8632,
            longitude=106.6535,
        )
    )
    pending = Order(
        order_code="MULTI-PENDING",
        customer_name="Pending",
        address="Quan 1",
        latitude=10.77,
        longitude=106.70,
        weight_kg=5,
        status=OrderStatus.PENDING,
    )
    assigned = Order(
        order_code="MULTI-ASSIGNED",
        customer_name="Assigned",
        address="Quan 3",
        latitude=10.78,
        longitude=106.68,
        weight_kg=5,
        status=OrderStatus.ASSIGNED,
    )
    db.add_all([pending, assigned])
    db.commit()

    with pytest.raises(MultiStopDispatchError) as error:
        dispatch_optimized_route(
            db,
            order_ids=[pending.id, assigned.id],
            driver_id=driver.id,
        )

    assert error.value.status_code == 409
    db.refresh(pending)
    db.refresh(vehicle)
    assert pending.status is OrderStatus.PENDING
    assert pending.assigned_vehicle_id is None
    assert vehicle.status is VehicleStatus.IDLE


def test_multi_stop_dispatch_endpoint_is_exposed_in_openapi() -> None:
    operation = app.openapi()["paths"]["/api/v1/routes/dispatch"]["post"]
    response_schema = app.openapi()["components"]["schemas"][
        "MultiStopDispatchResponse"
    ]

    assert operation["tags"] == ["route-optimization"]
    assert "stops" in response_schema["properties"]
    assert "route_batch_id" in response_schema["properties"]
