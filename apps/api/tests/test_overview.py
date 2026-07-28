from app.api.v1.overview import get_overview
from app.db.models import RouteAnalyticsSnapshot


class _FakeOverviewSession:
    def __init__(self, snapshot: RouteAnalyticsSnapshot | None) -> None:
        self._values: list[object] = [
            4,
            3,
            2,
            1,
            2,
            1,
            3,
            snapshot,
        ]

    def scalar(self, _statement: object) -> object:
        return self._values.pop(0)


def test_overview_returns_latest_route_cost_analytics() -> None:
    snapshot = RouteAnalyticsSnapshot(
        total_distance_km=42,
        total_duration_mins=126,
        fuel_cost_vnd=118_440,
        driver_cost_vnd=315_000,
        total_cost_vnd=433_440,
        co2_emissions_kg=11.642,
        estimated_savings_vnd=78_019.2,
        estimated_co2_savings_kg=2.096,
        savings_rate=0.18,
    )
    session = _FakeOverviewSession(snapshot)

    overview = get_overview(session)  # type: ignore[arg-type]

    assert overview.estimated_operating_cost_vnd == 433_440
    assert overview.estimated_savings_vnd == 78_019.2
    assert overview.co2_emissions_kg == 11.642
    assert overview.estimated_co2_savings_kg == 2.096
    assert overview.failed_orders_count == 1
