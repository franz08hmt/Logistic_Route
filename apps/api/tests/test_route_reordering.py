from uuid import uuid4

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.base import Base
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
from app.main import app
from app.schemas import (
    RouteReorderRequest,
    StopReorderInput,
    VehicleRouteReorderInput,
)
from app.services.route_reordering import RouteReorderError, reorder_routes


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


def _route_fixture(db: Session) -> tuple[User, Vehicle, Vehicle, list[Order], object]:
    dispatcher = User(
        email="reorder.dispatcher@test.vn",
        hashed_password="test-hash",
        full_name="Route Dispatcher",
        role=UserRole.DISPATCHER,
        status=UserStatus.ACTIVE,
    )
    depot = Depot(
        name="Kho Quan 12",
        address="Quan 12, Ho Chi Minh City",
        latitude=10.8632,
        longitude=106.6535,
    )
    first_vehicle = Vehicle(
        license_plate="51D-REORDER-1",
        capacity_kg=100,
        status=VehicleStatus.ON_ROUTE,
    )
    second_vehicle = Vehicle(
        license_plate="51D-REORDER-2",
        capacity_kg=80,
        status=VehicleStatus.ON_ROUTE,
    )
    db.add_all([dispatcher, depot, first_vehicle, second_vehicle])
    db.flush()
    batch_id = uuid4()
    orders = [
        Order(
            order_code=f"REORDER-{index}",
            customer_name=f"Customer {index}",
            address=f"Stop {index}",
            latitude=10.77 + index * 0.01,
            longitude=106.68 + index * 0.01,
            weight_kg=weight,
            status=OrderStatus.ASSIGNED,
            assigned_vehicle_id=vehicle_id,
            route_batch_id=batch_id,
            stop_sequence=sequence,
        )
        for index, weight, vehicle_id, sequence in (
            (1, 20.0, first_vehicle.id, 1),
            (2, 30.0, first_vehicle.id, 2),
            (3, 25.0, second_vehicle.id, 1),
        )
    ]
    db.add_all(orders)
    db.commit()
    return dispatcher, first_vehicle, second_vehicle, orders, batch_id


def test_reorder_routes_moves_stops_atomically_and_records_metrics(
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    dispatcher, first_vehicle, second_vehicle, orders, batch_id = _route_fixture(db)
    monkeypatch.setattr(
        "app.services.route_reordering.request_osrm_metrics",
        lambda *args, **kwargs: None,
    )
    payload = RouteReorderRequest(
        route_batch_id=batch_id,
        routes=[
            VehicleRouteReorderInput(
                vehicle_id=first_vehicle.id,
                stops=[StopReorderInput(order_id=orders[1].id, stop_sequence=1)],
            ),
            VehicleRouteReorderInput(
                vehicle_id=second_vehicle.id,
                stops=[
                    StopReorderInput(order_id=orders[2].id, stop_sequence=1),
                    StopReorderInput(order_id=orders[0].id, stop_sequence=2),
                ],
            ),
        ],
    )

    run = reorder_routes(db, payload=payload, actor=dispatcher)

    for order in orders:
        db.refresh(order)
    assert orders[0].assigned_vehicle_id == second_vehicle.id
    assert orders[0].stop_sequence == 2
    assert orders[1].assigned_vehicle_id == first_vehicle.id
    assert orders[1].stop_sequence == 1
    assert orders[2].assigned_vehicle_id == second_vehicle.id
    assert orders[2].stop_sequence == 1
    assert run.route_batch_id == batch_id
    assert [route.total_weight_kg for route in run.result.routes] == [30.0, 45.0]
    assert run.result.total_distance_km > 0
    assert run.cost_metrics.total_cost_vnd > 0
    assert db.scalar(select(RouteAnalyticsSnapshot)) is not None
    activities = list(db.scalars(select(OrderActivityLog)).all())
    assert {activity.order_id for activity in activities} == {
        orders[0].id,
        orders[1].id,
    }
    assert {activity.action for activity in activities} == {"ASSIGNED"}


def test_reorder_routes_rejects_capacity_overflow_without_partial_changes(
    db: Session,
) -> None:
    dispatcher, first_vehicle, second_vehicle, orders, batch_id = _route_fixture(db)
    second_vehicle.capacity_kg = 40
    db.commit()
    payload = RouteReorderRequest(
        route_batch_id=batch_id,
        routes=[
            VehicleRouteReorderInput(vehicle_id=first_vehicle.id, stops=[]),
            VehicleRouteReorderInput(
                vehicle_id=second_vehicle.id,
                stops=[
                    StopReorderInput(order_id=order.id, stop_sequence=index)
                    for index, order in enumerate(orders, start=1)
                ],
            ),
        ],
    )

    with pytest.raises(RouteReorderError) as error:
        reorder_routes(db, payload=payload, actor=dispatcher)

    assert error.value.status_code == 409
    assert error.value.detail["code"] == "VEHICLE_CAPACITY_EXCEEDED"
    for order in orders:
        db.refresh(order)
    assert orders[0].assigned_vehicle_id == first_vehicle.id
    assert orders[0].stop_sequence == 1
    assert orders[2].assigned_vehicle_id == second_vehicle.id


def test_reorder_routes_requires_vacated_source_vehicle_in_configuration(
    db: Session,
) -> None:
    dispatcher, first_vehicle, second_vehicle, orders, batch_id = _route_fixture(db)
    payload = RouteReorderRequest(
        route_batch_id=batch_id,
        routes=[
            VehicleRouteReorderInput(
                vehicle_id=second_vehicle.id,
                stops=[
                    StopReorderInput(order_id=order.id, stop_sequence=index)
                    for index, order in enumerate(orders, start=1)
                ],
            ),
        ],
    )

    with pytest.raises(RouteReorderError) as error:
        reorder_routes(db, payload=payload, actor=dispatcher)

    assert error.value.status_code == 409
    assert error.value.detail["code"] == "ROUTE_VEHICLE_MISMATCH"
    db.refresh(first_vehicle)
    assert first_vehicle.status is VehicleStatus.ON_ROUTE


def test_reorder_request_rejects_duplicate_orders_and_non_contiguous_sequences() -> None:
    order_id = uuid4()
    with pytest.raises(ValueError):
        RouteReorderRequest(
            route_batch_id=uuid4(),
            routes=[
                VehicleRouteReorderInput(
                    vehicle_id=uuid4(),
                    stops=[StopReorderInput(order_id=order_id, stop_sequence=2)],
                ),
                VehicleRouteReorderInput(
                    vehicle_id=uuid4(),
                    stops=[StopReorderInput(order_id=order_id, stop_sequence=1)],
                ),
            ],
        )


def test_route_reorder_endpoint_is_exposed_in_openapi() -> None:
    operation = app.openapi()["paths"]["/api/v1/routes/reorder"]["post"]

    assert operation["tags"] == ["route-optimization"]
    assert operation["responses"]["200"]["content"]["application/json"]["schema"]
