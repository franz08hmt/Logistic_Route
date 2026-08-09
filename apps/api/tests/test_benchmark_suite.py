from core_engine.benchmark_suite import (
    build_benchmark_input,
    calculate_capacity_utilization,
    render_markdown,
)
from core_engine.solver import Route, Stop, VRPOutput


def test_build_benchmark_input_is_deterministic_and_feasible() -> None:
    first = build_benchmark_input(25, seed=7)
    second = build_benchmark_input(25, seed=7)

    assert first == second
    assert len(first.orders) == 25
    assert sum(vehicle.capacity_kg for vehicle in first.vehicles) >= sum(
        order.weight_kg for order in first.orders
    )


def test_capacity_utilization_counts_only_used_vehicles() -> None:
    data = build_benchmark_input(10, seed=9)
    result = VRPOutput(
        status="OPTIMAL",
        total_distance_km=10,
        total_duration_mins=30,
        unassigned_orders=[],
        routes=[
            Route(
                vehicle_id=data.vehicles[0].id,
                license_plate=data.vehicles[0].license_plate,
                total_weight_kg=500,
                distance_km=10,
                stops=[
                    Stop(
                        stop_sequence=1,
                        order_id=data.orders[0].id,
                        address=data.orders[0].address,
                        latitude=data.orders[0].latitude,
                        longitude=data.orders[0].longitude,
                    )
                ],
            )
        ],
    )

    assert calculate_capacity_utilization(result, data) == 50.0
    assert "Capacity utilization" in render_markdown([
        {
            "orders": 10,
            "vehicles": 1,
            "solver_status": "OPTIMAL",
            "solve_time_ms": 20.0,
            "total_distance_km": 10.0,
            "capacity_utilization_percent": 50.0,
            "assigned_orders": 10,
        }
    ])
