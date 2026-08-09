"""Deterministic end-to-end benchmarks for the LogiRoute CVRP engine.

The suite measures solver wall time, route distance, and utilized capacity for
10, 25, 50, and 100-order datasets. It writes machine-readable JSON and a
Markdown table suitable for technical reports.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import time
from pathlib import Path
from typing import Any, Iterable

from core_engine.solver import Depot, Order, VRPInput, VRPOutput, VRPSolver, Vehicle


DEFAULT_CASES = (10, 25, 50, 100)
DEPOT_LATITUDE = 10.8671
DEPOT_LONGITUDE = 106.6412
VEHICLE_CAPACITY_KG = 1_000.0


def build_benchmark_input(order_count: int, seed: int = 2026) -> VRPInput:
    """Build reproducible, feasible HCMC-like delivery data."""
    if order_count <= 0:
        raise ValueError("order_count must be positive")

    randomizer = random.Random(seed + order_count)
    orders = [
        Order(
            id=f"BENCH-{order_count:03d}-{index + 1:03d}",
            address=f"Benchmark delivery point {index + 1}, Ho Chi Minh City",
            latitude=DEPOT_LATITUDE + randomizer.uniform(-0.12, 0.12),
            longitude=DEPOT_LONGITUDE + randomizer.uniform(-0.12, 0.12),
            weight_kg=round(randomizer.uniform(25.0, 120.0), 2),
        )
        for index in range(order_count)
    ]
    total_demand = sum(order.weight_kg for order in orders)
    vehicle_count = max(1, math.ceil(total_demand * 1.2 / VEHICLE_CAPACITY_KG))
    vehicles = [
        Vehicle(
            id=f"BENCH-VEHICLE-{index + 1:02d}",
            license_plate=f"51D-B{index + 1:04d}",
            capacity_kg=VEHICLE_CAPACITY_KG,
        )
        for index in range(vehicle_count)
    ]
    return VRPInput(
        depot=Depot(
            id="HUB-SGN",
            name="LogiRoute Hub Ho Chi Minh City",
            latitude=DEPOT_LATITUDE,
            longitude=DEPOT_LONGITUDE,
        ),
        vehicles=vehicles,
        orders=orders,
    )


def calculate_capacity_utilization(result: VRPOutput, data: VRPInput) -> float:
    """Return assigned load divided by capacity of vehicles actually used."""
    capacities = {vehicle.id: vehicle.capacity_kg for vehicle in data.vehicles}
    used_capacity = sum(capacities[route.vehicle_id] for route in result.routes)
    if used_capacity <= 0:
        return 0.0
    assigned_weight = sum(route.total_weight_kg for route in result.routes)
    return round((assigned_weight / used_capacity) * 100, 2)


def run_case(order_count: int, time_limit_seconds: int, seed: int) -> dict[str, Any]:
    data = build_benchmark_input(order_count, seed)
    started_at = time.perf_counter()
    result = VRPSolver(data=data, time_limit_seconds=time_limit_seconds).solve()
    elapsed_ms = (time.perf_counter() - started_at) * 1_000
    return {
        "orders": order_count,
        "vehicles": len(data.vehicles),
        "solver_status": result.status,
        "solve_time_ms": round(elapsed_ms, 2),
        "total_distance_km": result.total_distance_km,
        "capacity_utilization_percent": calculate_capacity_utilization(result, data),
        "assigned_orders": order_count - len(result.unassigned_orders),
        "unassigned_orders": len(result.unassigned_orders),
    }


def render_markdown(results: Iterable[dict[str, Any]]) -> str:
    rows = [
        "# LogiRoute VN CVRP Benchmark",
        "",
        "| Orders | Vehicles | Status | Solve time (ms) | Distance (km) | Capacity utilization | Assigned |",
        "|---:|---:|:---|---:|---:|---:|---:|",
    ]
    for result in results:
        rows.append(
            "| {orders} | {vehicles} | {solver_status} | {solve_time_ms:.2f} | "
            "{total_distance_km:.2f} | {capacity_utilization_percent:.2f}% | "
            "{assigned_orders} |".format(**result)
        )
    rows.extend([
        "",
        "> Capacity utilization is measured against vehicles that received at least one stop.",
    ])
    return "\n".join(rows)


def run_suite(
    cases: Iterable[int] = DEFAULT_CASES,
    *,
    time_limit_seconds: int = 2,
    seed: int = 2026,
) -> list[dict[str, Any]]:
    return [run_case(case, time_limit_seconds, seed) for case in cases]


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark the LogiRoute CVRP solver")
    parser.add_argument("--time-limit", type=int, default=2, help="Solver limit per dataset in seconds")
    parser.add_argument("--seed", type=int, default=2026, help="Deterministic dataset seed")
    parser.add_argument("--json-output", type=Path, default=Path("core_engine/benchmark_results.json"))
    parser.add_argument("--markdown-output", type=Path, default=Path("core_engine/benchmark_results.md"))
    args = parser.parse_args()
    if args.time_limit <= 0:
        parser.error("--time-limit must be positive")

    results = run_suite(time_limit_seconds=args.time_limit, seed=args.seed)
    markdown = render_markdown(results)
    payload = {
        "suite": "LogiRoute VN CVRP",
        "seed": args.seed,
        "time_limit_seconds_per_case": args.time_limit,
        "results": results,
    }
    args.json_output.parent.mkdir(parents=True, exist_ok=True)
    args.markdown_output.parent.mkdir(parents=True, exist_ok=True)
    args.json_output.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    args.markdown_output.write_text(markdown + "\n", encoding="utf-8")
    print(markdown)
    print(f"\nJSON: {args.json_output}")
    print(f"Markdown: {args.markdown_output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
