import math
from dataclasses import dataclass


FUEL_CONSUMPTION_LITERS_PER_100_KM = 12.0
FUEL_PRICE_VND_PER_LITER = 23_500.0
DRIVER_COST_VND_PER_HOUR = 150_000.0
CO2_KG_PER_LITER = 2.31
ESTIMATED_SAVINGS_RATE = 0.18


@dataclass(frozen=True)
class CostCalculation:
    fuel_cost_vnd: float
    driver_cost_vnd: float
    total_cost_vnd: float
    co2_emissions_kg: float
    estimated_savings_vnd: float
    estimated_co2_savings_kg: float
    savings_rate: float = ESTIMATED_SAVINGS_RATE


def calculate_route_costs(
    *,
    total_distance_km: float,
    total_time_minutes: float,
) -> CostCalculation:
    """Calculate route cost and environmental estimates from solver totals."""
    if (
        not math.isfinite(total_distance_km)
        or not math.isfinite(total_time_minutes)
        or total_distance_km < 0
        or total_time_minutes < 0
    ):
        raise ValueError("Route distance and duration must be finite, non-negative values")

    fuel_liters = (
        total_distance_km / 100
    ) * FUEL_CONSUMPTION_LITERS_PER_100_KM
    fuel_cost_vnd = round(fuel_liters * FUEL_PRICE_VND_PER_LITER, 2)
    driver_cost_vnd = round(
        total_time_minutes * (DRIVER_COST_VND_PER_HOUR / 60),
        2,
    )
    total_cost_vnd = round(fuel_cost_vnd + driver_cost_vnd, 2)
    co2_emissions_kg = round(fuel_liters * CO2_KG_PER_LITER, 3)

    return CostCalculation(
        fuel_cost_vnd=fuel_cost_vnd,
        driver_cost_vnd=driver_cost_vnd,
        total_cost_vnd=total_cost_vnd,
        co2_emissions_kg=co2_emissions_kg,
        estimated_savings_vnd=round(total_cost_vnd * ESTIMATED_SAVINGS_RATE, 2),
        estimated_co2_savings_kg=round(
            co2_emissions_kg * ESTIMATED_SAVINGS_RATE,
            3,
        ),
    )
