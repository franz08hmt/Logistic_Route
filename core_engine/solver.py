"""
LogiRoute VN — Core Route Optimization Engine
================================================
Solves the Capacitated Vehicle Routing Problem (CVRP) using Google OR-Tools.

Features
--------
- Haversine-based distance matrix between all coordinates.
- Vehicle capacity constraints (weight_kg ≤ capacity_kg).
- Objective: minimise total fleet travel distance.
- Returns structured JSON output via Pydantic models.

Usage
-----
    python core_engine/solver.py          # runs built-in demo
    python -c "from core_engine.solver import VRPSolver; ..."
"""

from __future__ import annotations

import math
import json
from dataclasses import dataclass
from typing import Optional

from pydantic import BaseModel, Field
from ortools.constraint_solver import routing_enums_pb2, pywrapcp


# ┌──────────────────────────────────────────────────────────────────┐
# │                   Pydantic I/O Contracts                         │
# └──────────────────────────────────────────────────────────────────┘

class Depot(BaseModel):
    """Central warehouse / starting point for all vehicles."""
    id: str
    name: str
    latitude: float
    longitude: float


class Vehicle(BaseModel):
    """A delivery vehicle with a maximum weight capacity."""
    id: str
    license_plate: str
    capacity_kg: float = Field(gt=0, description="Maximum payload in kilograms")


class Order(BaseModel):
    """A single delivery order to be fulfilled."""
    id: str
    address: str
    latitude: float
    longitude: float
    weight_kg: float = Field(gt=0, description="Package weight in kilograms")


class VRPInput(BaseModel):
    """Complete input for the VRP solver."""
    depot: Depot
    vehicles: list[Vehicle]
    orders: list[Order]


class Stop(BaseModel):
    """One stop within a planned route."""
    stop_sequence: int
    order_id: str
    address: str
    latitude: float
    longitude: float


class Route(BaseModel):
    """Planned route for a single vehicle."""
    vehicle_id: str
    license_plate: str
    total_weight_kg: float
    distance_km: float
    stops: list[Stop]


class VRPOutput(BaseModel):
    """Complete output of the VRP solver."""
    status: str  # "OPTIMAL", "FEASIBLE", "INFEASIBLE", "ERROR"
    total_distance_km: float
    total_duration_mins: float
    unassigned_orders: list[str]
    routes: list[Route]


# ┌──────────────────────────────────────────────────────────────────┐
# │                   Haversine Distance Utilities                   │
# └──────────────────────────────────────────────────────────────────┘

_EARTH_RADIUS_KM = 6_371.0


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return the great-circle distance in kilometres between two GPS points."""
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    Δφ = math.radians(lat2 - lat1)
    Δλ = math.radians(lon2 - lon1)

    a = math.sin(Δφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(Δλ / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return _EARTH_RADIUS_KM * c


def build_distance_matrix(
    coords: list[tuple[float, float]],
) -> list[list[int]]:
    """Build a symmetric distance matrix in **metres** (integers).

    OR-Tools works best with integer costs, so we multiply km × 1000
    and round to the nearest metre.

    Parameters
    ----------
    coords : list of (latitude, longitude) tuples.
             Index 0 must be the depot.

    Returns
    -------
    A square matrix where ``matrix[i][j]`` is the distance in metres
    from node *i* to node *j*.
    """
    n = len(coords)
    matrix: list[list[int]] = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            d = int(round(haversine_km(*coords[i], *coords[j]) * 1000))
            matrix[i][j] = d
            matrix[j][i] = d
    return matrix


# ┌──────────────────────────────────────────────────────────────────┐
# │                         VRP Solver                               │
# └──────────────────────────────────────────────────────────────────┘

# Average urban speed assumption for duration estimation.
_AVG_SPEED_KMH = 20.0


class VRPSolver:
    """Solve a Capacitated Vehicle Routing Problem (CVRP).

    The solver minimises total fleet travel distance while ensuring
    that no vehicle exceeds its weight capacity.

    Parameters
    ----------
    data : VRPInput
        Validated input containing depot, vehicles, and orders.
    time_limit_seconds : int
        Maximum wall-clock time for the solver (default 30 s).

    Example
    -------
    >>> solver = VRPSolver(data=my_input, time_limit_seconds=10)
    >>> result = solver.solve()
    >>> print(result.model_dump_json(indent=2))
    """

    def __init__(self, data: VRPInput, time_limit_seconds: int = 30) -> None:
        self._data = data
        self._time_limit = time_limit_seconds

        # Build ordered coordinate list: index 0 = depot, then orders.
        self._coords: list[tuple[float, float]] = [
            (data.depot.latitude, data.depot.longitude),
        ]
        for order in data.orders:
            self._coords.append((order.latitude, order.longitude))

        self._distance_matrix = build_distance_matrix(self._coords)
        self._num_nodes = len(self._coords)
        self._num_vehicles = len(data.vehicles)

    # ── public API ────────────────────────────────────────────────

    def solve(self) -> VRPOutput:
        """Run the optimisation and return a :class:`VRPOutput`."""
        if not self._data.orders:
            return VRPOutput(
                status="OPTIMAL",
                total_distance_km=0.0,
                total_duration_mins=0.0,
                unassigned_orders=[],
                routes=[],
            )

        if not self._data.vehicles:
            return VRPOutput(
                status="INFEASIBLE",
                total_distance_km=0.0,
                total_duration_mins=0.0,
                unassigned_orders=[o.id for o in self._data.orders],
                routes=[],
            )

        try:
            manager, routing, solution = self._run_ortools()
        except Exception as exc:
            return VRPOutput(
                status="ERROR",
                total_distance_km=0.0,
                total_duration_mins=0.0,
                unassigned_orders=[o.id for o in self._data.orders],
                routes=[],
            )

        if solution is None:
            return VRPOutput(
                status="INFEASIBLE",
                total_distance_km=0.0,
                total_duration_mins=0.0,
                unassigned_orders=[o.id for o in self._data.orders],
                routes=[],
            )

        return self._extract_solution(manager, routing, solution)

    # ── private helpers ───────────────────────────────────────────

    def _run_ortools(
        self,
    ) -> tuple[pywrapcp.RoutingIndexManager, pywrapcp.RoutingModel, Optional[object]]:
        """Configure and run the OR-Tools CVRP solver."""

        manager = pywrapcp.RoutingIndexManager(
            self._num_nodes,
            self._num_vehicles,
            0,  # depot index
        )
        routing = pywrapcp.RoutingModel(manager)

        # ── Distance callback ────────────────────────────────────
        def distance_callback(from_index: int, to_index: int) -> int:
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return self._distance_matrix[from_node][to_node]

        transit_cb_index = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_cb_index)

        # ── Capacity constraint ──────────────────────────────────
        demands = [0]  # depot has zero demand
        for order in self._data.orders:
            demands.append(int(round(order.weight_kg * 100)))  # scale to int (0.01 kg precision)

        def demand_callback(from_index: int) -> int:
            node = manager.IndexToNode(from_index)
            return demands[node]

        demand_cb_index = routing.RegisterUnaryTransitCallback(demand_callback)

        vehicle_capacities = [
            int(round(v.capacity_kg * 100)) for v in self._data.vehicles
        ]

        routing.AddDimensionWithVehicleCapacity(
            demand_cb_index,
            0,            # no slack
            vehicle_capacities,
            True,         # start cumul to zero
            "Capacity",
        )

        # ── Allow dropping orders when infeasible (large penalty) ─
        penalty = 100_000_000  # high cost to drop a node
        for node in range(1, self._num_nodes):
            routing.AddDisjunction([manager.NodeToIndex(node)], penalty)

        # ── Search parameters ────────────────────────────────────
        search_params = pywrapcp.DefaultRoutingSearchParameters()
        search_params.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        )
        search_params.local_search_metaheuristic = (
            routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        )
        search_params.time_limit.FromSeconds(self._time_limit)

        solution = routing.SolveWithParameters(search_params)
        return manager, routing, solution

    def _extract_solution(
        self,
        manager: pywrapcp.RoutingIndexManager,
        routing: pywrapcp.RoutingModel,
        solution: object,
    ) -> VRPOutput:
        """Parse the OR-Tools solution into a :class:`VRPOutput`."""

        routes: list[Route] = []
        total_distance_m = 0
        assigned_order_indices: set[int] = set()

        for vehicle_idx in range(self._num_vehicles):
            index = routing.Start(vehicle_idx)
            stops: list[Stop] = []
            route_distance_m = 0
            route_weight_kg = 0.0
            stop_seq = 0

            while not routing.IsEnd(index):
                node = manager.IndexToNode(index)
                next_index = solution.Value(routing.NextVar(index))
                route_distance_m += routing.GetArcCostForVehicle(
                    index, next_index, vehicle_idx
                )

                if node != 0:  # skip depot
                    order = self._data.orders[node - 1]
                    stop_seq += 1
                    stops.append(
                        Stop(
                            stop_sequence=stop_seq,
                            order_id=order.id,
                            address=order.address,
                            latitude=order.latitude,
                            longitude=order.longitude,
                        )
                    )
                    route_weight_kg += order.weight_kg
                    assigned_order_indices.add(node - 1)

                index = next_index

            if stops:
                veh = self._data.vehicles[vehicle_idx]
                routes.append(
                    Route(
                        vehicle_id=veh.id,
                        license_plate=veh.license_plate,
                        total_weight_kg=round(route_weight_kg, 2),
                        distance_km=round(route_distance_m / 1000, 2),
                        stops=stops,
                    )
                )
            total_distance_m += route_distance_m

        # Identify unassigned orders
        unassigned = [
            self._data.orders[i].id
            for i in range(len(self._data.orders))
            if i not in assigned_order_indices
        ]

        total_km = round(total_distance_m / 1000, 2)
        total_mins = round((total_km / _AVG_SPEED_KMH) * 60, 1)

        status = "OPTIMAL" if not unassigned else "FEASIBLE"

        return VRPOutput(
            status=status,
            total_distance_km=total_km,
            total_duration_mins=total_mins,
            unassigned_orders=unassigned,
            routes=routes,
        )


# ┌──────────────────────────────────────────────────────────────────┐
# │                       Standalone Demo                            │
# └──────────────────────────────────────────────────────────────────┘

if __name__ == "__main__":
    # ── Demo data: 1 depot in District 12, 8 real orders across HCMC ──
    demo_input = VRPInput(
        depot=Depot(
            id="depot_1",
            name="Kho Quận 12, TP.HCM",
            latitude=10.8671,
            longitude=106.6412,
        ),
        vehicles=[
            Vehicle(id="veh_1", license_plate="59C-12345", capacity_kg=1000.0),
            Vehicle(id="veh_2", license_plate="59C-67890", capacity_kg=1500.0),
            Vehicle(id="veh_3", license_plate="59C-11111", capacity_kg=800.0),
        ],
        orders=[
            Order(
                id="ord_101",
                address="123 Lê Lợi, Quận 1, TP.HCM",
                latitude=10.7769,
                longitude=106.7009,
                weight_kg=250.0,
            ),
            Order(
                id="ord_102",
                address="456 Nguyễn Thị Minh Khai, Quận 3, TP.HCM",
                latitude=10.7798,
                longitude=106.6890,
                weight_kg=400.0,
            ),
            Order(
                id="ord_103",
                address="789 Cách Mạng Tháng 8, Quận 10, TP.HCM",
                latitude=10.7726,
                longitude=106.6684,
                weight_kg=350.0,
            ),
            Order(
                id="ord_104",
                address="12 Trần Hưng Đạo, Quận 5, TP.HCM",
                latitude=10.7546,
                longitude=106.6735,
                weight_kg=600.0,
            ),
            Order(
                id="ord_105",
                address="34 Nguyễn Huệ, Quận 1, TP.HCM",
                latitude=10.7738,
                longitude=106.7029,
                weight_kg=150.0,
            ),
            Order(
                id="ord_106",
                address="56 Phan Xích Long, Phú Nhuận, TP.HCM",
                latitude=10.7996,
                longitude=106.6824,
                weight_kg=500.0,
            ),
            Order(
                id="ord_107",
                address="78 Lý Tự Trọng, Quận 1, TP.HCM",
                latitude=10.7775,
                longitude=106.6999,
                weight_kg=200.0,
            ),
            Order(
                id="ord_108",
                address="90 Nguyễn Văn Trỗi, Phú Nhuận, TP.HCM",
                latitude=10.7995,
                longitude=106.6757,
                weight_kg=450.0,
            ),
        ],
    )

    print("=" * 64)
    print("  LogiRoute VN — CVRP Solver Demo")
    print("=" * 64)
    print(f"\n📦 Depot     : {demo_input.depot.name}")
    print(f"🚛 Vehicles  : {len(demo_input.vehicles)}")
    print(f"📋 Orders    : {len(demo_input.orders)}")

    total_demand = sum(o.weight_kg for o in demo_input.orders)
    total_capacity = sum(v.capacity_kg for v in demo_input.vehicles)
    print(f"⚖️  Demand    : {total_demand:,.0f} kg")
    print(f"⚖️  Capacity  : {total_capacity:,.0f} kg")
    print(f"\n⏳ Solving (time limit = 30s) ...")

    solver = VRPSolver(data=demo_input, time_limit_seconds=30)
    result = solver.solve()

    print(f"\n✅ Status           : {result.status}")
    print(f"📏 Total Distance   : {result.total_distance_km} km")
    print(f"⏱️  Est. Duration    : {result.total_duration_mins} mins")
    print(f"🚫 Unassigned Orders: {result.unassigned_orders or 'None'}")

    for route in result.routes:
        print(f"\n{'─' * 50}")
        print(f"🚛 Vehicle {route.vehicle_id} ({route.license_plate})")
        print(f"   Weight: {route.total_weight_kg} kg  |  Distance: {route.distance_km} km")
        for stop in route.stops:
            print(f"   └─ Stop #{stop.stop_sequence}: {stop.order_id} → {stop.address}")

    print(f"\n{'=' * 64}")
    print("\n📄 Full JSON output:\n")
    print(result.model_dump_json(indent=2))
