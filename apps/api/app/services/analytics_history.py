from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from datetime import date, datetime, timedelta, timezone
from typing import Literal
from zoneinfo import ZoneInfo

from app.db.models import RouteAnalyticsSnapshot
from app.schemas import (
    AnalyticsDataPoint,
    AnalyticsHistoryResponse,
    AnalyticsSummary,
)


HCM_TIMEZONE = ZoneInfo("Asia/Ho_Chi_Minh")
AnalyticsGrouping = Literal["day", "week"]


def analytics_window_start(*, days: int, now: datetime | None = None) -> datetime:
    """Return the UTC lower bound for the requested rolling period."""
    reference = _as_utc(now or datetime.now(timezone.utc))
    return reference - timedelta(days=days)


def build_analytics_history(
    snapshots: Iterable[RouteAnalyticsSnapshot],
    *,
    days: int,
    group_by: AnalyticsGrouping,
    now: datetime | None = None,
) -> AnalyticsHistoryResponse:
    """Aggregate route snapshots into HCM-local day or ISO-week buckets."""
    window_start = analytics_window_start(days=days, now=now)
    buckets: dict[date, list[RouteAnalyticsSnapshot]] = defaultdict(list)
    included: list[RouteAnalyticsSnapshot] = []

    for snapshot in snapshots:
        created_at = _as_utc(snapshot.created_at)
        if created_at < window_start:
            continue
        local_date = created_at.astimezone(HCM_TIMEZONE).date()
        bucket_date = (
            local_date
            if group_by == "day"
            else local_date - timedelta(days=local_date.weekday())
        )
        buckets[bucket_date].append(snapshot)
        included.append(snapshot)

    data_points = [
        _aggregate_bucket(bucket_date, buckets[bucket_date])
        for bucket_date in sorted(buckets)
    ]
    total_savings = sum(point.estimated_savings_vnd for point in data_points)
    best_point = max(
        data_points,
        key=lambda point: point.estimated_savings_vnd,
        default=None,
    )
    average_rate = (
        sum(snapshot.savings_rate for snapshot in included) / len(included)
        if included
        else 0.0
    )

    return AnalyticsHistoryResponse(
        summary=AnalyticsSummary(
            period_label=f"{days} ngày gần nhất",
            total_optimizations=len(included),
            total_distance_km=_rounded(
                sum(point.total_distance_km for point in data_points)
            ),
            total_cost_vnd=_rounded(
                sum(point.total_cost_vnd for point in data_points)
            ),
            total_savings_vnd=_rounded(total_savings),
            total_co2_saved_kg=_rounded(
                sum(point.estimated_co2_savings_kg for point in data_points)
            ),
            avg_savings_rate=round(average_rate, 4),
            best_day=best_point.date if best_point else None,
            best_day_savings_vnd=(
                best_point.estimated_savings_vnd if best_point else 0.0
            ),
        ),
        data_points=data_points,
    )


def _aggregate_bucket(
    bucket_date: date,
    snapshots: list[RouteAnalyticsSnapshot],
) -> AnalyticsDataPoint:
    return AnalyticsDataPoint(
        date=bucket_date.isoformat(),
        total_distance_km=_rounded(
            sum(snapshot.total_distance_km for snapshot in snapshots)
        ),
        total_duration_mins=_rounded(
            sum(snapshot.total_duration_mins for snapshot in snapshots)
        ),
        total_cost_vnd=_rounded(
            sum(snapshot.total_cost_vnd for snapshot in snapshots)
        ),
        fuel_cost_vnd=_rounded(
            sum(snapshot.fuel_cost_vnd for snapshot in snapshots)
        ),
        driver_cost_vnd=_rounded(
            sum(snapshot.driver_cost_vnd for snapshot in snapshots)
        ),
        co2_emissions_kg=_rounded(
            sum(snapshot.co2_emissions_kg for snapshot in snapshots)
        ),
        estimated_savings_vnd=_rounded(
            sum(snapshot.estimated_savings_vnd for snapshot in snapshots)
        ),
        estimated_co2_savings_kg=_rounded(
            sum(snapshot.estimated_co2_savings_kg for snapshot in snapshots)
        ),
        optimization_runs=len(snapshots),
    )


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _rounded(value: float) -> float:
    return round(float(value), 3)
