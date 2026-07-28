import math

import pytest

from app.services.cost_calculator import calculate_route_costs


def test_calculate_route_costs_uses_logiroute_business_assumptions() -> None:
    metrics = calculate_route_costs(
        total_distance_km=100,
        total_time_minutes=60,
    )

    assert metrics.fuel_cost_vnd == pytest.approx(282_000)
    assert metrics.driver_cost_vnd == pytest.approx(150_000)
    assert metrics.total_cost_vnd == pytest.approx(432_000)
    assert metrics.co2_emissions_kg == pytest.approx(27.72)
    assert metrics.estimated_savings_vnd == pytest.approx(77_760)
    assert metrics.estimated_co2_savings_kg == pytest.approx(4.99)
    assert metrics.savings_rate == pytest.approx(0.18)


@pytest.mark.parametrize(
    ("distance", "duration"),
    [
        (-1, 10),
        (10, -1),
        (math.inf, 10),
        (10, math.nan),
    ],
)
def test_calculate_route_costs_rejects_invalid_totals(
    distance: float,
    duration: float,
) -> None:
    with pytest.raises(ValueError):
        calculate_route_costs(
            total_distance_km=distance,
            total_time_minutes=duration,
        )
