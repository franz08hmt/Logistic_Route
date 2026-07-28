from uuid import uuid4

import pytest

from app.db.models import Depot, Order, OrderStatus, Vehicle, VehicleStatus
from app.services.route_optimization import (
    RouteOptimizationError,
    optimize_pending_routes,
)
from app.main import app
from core_engine.solver import Route, Stop, VRPOutput


class _Rows:
    def __init__(self, values: list[object]) -> None:
        self._values = values

    def all(self) -> list[object]:
        return self._values


class _FakeSession:
    def __init__(
        self,
        depot: Depot | None,
        vehicles: list[Vehicle] | None = None,
        orders: list[Order] | None = None,
    ) -> None:
        self._depot = depot
        self._result_sets = [vehicles or [], orders or []]
        self.commit_count = 0
        self.added: list[object] = []

    def scalar(self, _statement: object) -> Depot | None:
        return self._depot

    def scalars(self, _statement: object) -> _Rows:
        return _Rows(self._result_sets.pop(0))

    def commit(self) -> None:
        self.commit_count += 1

    def add(self, value: object) -> None:
        self.added.append(value)


def test_optimize_pending_and_failed_routes_assigns_only_orders_present_in_routes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    depot = Depot(
        id=uuid4(),
        name="Kho Quan 12",
        address="Quan 12, Ho Chi Minh City",
        latitude=10.8632,
        longitude=106.6535,
    )
    vehicle = Vehicle(
        id=uuid4(),
        license_plate="51D-12001",
        capacity_kg=1200,
        driver_name="Nguyen Van Minh",
        status=VehicleStatus.IDLE,
    )
    assigned_order = Order(
        id=uuid4(),
        order_code="LR-TEST-001",
        customer_name="Customer A",
        address="Quan 1, Ho Chi Minh City",
        latitude=10.7769,
        longitude=106.7009,
        weight_kg=12.5,
        status=OrderStatus.PENDING,
    )
    unassigned_order = Order(
        id=uuid4(),
        order_code="LR-TEST-002",
        customer_name="Customer B",
        address="Thu Duc, Ho Chi Minh City",
        latitude=10.8038,
        longitude=106.7337,
        weight_kg=20,
        status=OrderStatus.FAILED,
        failure_reason="Sai dia chi",
    )
    captured_input: dict[str, object] = {}

    class _StubSolver:
        def __init__(self, data: object, time_limit_seconds: int) -> None:
            captured_input["data"] = data
            captured_input["time_limit_seconds"] = time_limit_seconds

        def solve(self) -> VRPOutput:
            return VRPOutput(
                status="FEASIBLE",
                total_distance_km=18.4,
                total_duration_mins=55.2,
                unassigned_orders=[str(unassigned_order.id)],
                routes=[
                    Route(
                        vehicle_id=str(vehicle.id),
                        license_plate=vehicle.license_plate,
                        total_weight_kg=assigned_order.weight_kg,
                        distance_km=18.4,
                        stops=[
                            Stop(
                                stop_sequence=1,
                                order_id=str(assigned_order.id),
                                address=assigned_order.address,
                                latitude=assigned_order.latitude,
                                longitude=assigned_order.longitude,
                            )
                        ],
                    )
                ],
            )

    monkeypatch.setattr(
        "app.services.route_optimization.VRPSolver",
        _StubSolver,
    )
    session = _FakeSession(depot, [vehicle], [assigned_order, unassigned_order])

    run = optimize_pending_routes(session)  # type: ignore[arg-type]

    solver_input = captured_input["data"]
    assert solver_input.depot.id == str(depot.id)  # type: ignore[union-attr]
    assert solver_input.vehicles[0].license_plate == vehicle.license_plate  # type: ignore[union-attr]
    assert len(solver_input.orders) == 2  # type: ignore[union-attr]
    assert run.result.status == "FEASIBLE"
    assert assigned_order.status == OrderStatus.ASSIGNED
    assert unassigned_order.status == OrderStatus.FAILED
    assert session.commit_count == 1
    assert len(session.added) == 1
    assert run.cost_metrics.total_cost_vnd == pytest.approx(189_888)


def test_optimize_pending_routes_requires_a_default_depot() -> None:
    session = _FakeSession(depot=None)

    with pytest.raises(RouteOptimizationError) as error:
        optimize_pending_routes(session)  # type: ignore[arg-type]

    assert error.value.status_code == 404
    assert error.value.detail == "No depot is configured"


def test_optimize_endpoint_is_exposed_in_openapi() -> None:
    operation = app.openapi()["paths"]["/api/v1/routes/optimize"]["post"]
    response_schema = app.openapi()["components"]["schemas"]["RouteOptimizationResponse"]

    assert operation["tags"] == ["route-optimization"]
    assert operation["responses"]["200"]["content"]["application/json"]["schema"]
    assert "cost_metrics" in response_schema["properties"]
