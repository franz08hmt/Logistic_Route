from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.v1.analytics import get_analytics_history
from app.api.v1.seed import SEED_ORDERS, build_seed_analytics_snapshots, seed_data
from app.core.security import get_password_hash, require_roles
from app.db.base import Base
from app.db.models import (
    OrderActivityLog,
    RouteAnalyticsSnapshot,
    User,
    UserRole,
    UserStatus,
)
from app.services.analytics_history import build_analytics_history


def _snapshot(
    *,
    created_at: datetime,
    distance: float,
    total_cost: float,
    savings: float,
    savings_rate: float,
) -> RouteAnalyticsSnapshot:
    return RouteAnalyticsSnapshot(
        total_distance_km=distance,
        total_duration_mins=distance * 2,
        fuel_cost_vnd=total_cost * 0.4,
        driver_cost_vnd=total_cost * 0.6,
        total_cost_vnd=total_cost,
        co2_emissions_kg=distance * 0.25,
        estimated_savings_vnd=savings,
        estimated_co2_savings_kg=distance * 0.045,
        savings_rate=savings_rate,
        created_at=created_at,
    )


def test_analytics_history_groups_runs_by_ho_chi_minh_date() -> None:
    now = datetime(2026, 7, 31, 12, tzinfo=timezone.utc)
    snapshots = [
        _snapshot(
            created_at=datetime(2026, 7, 30, 16, 30, tzinfo=timezone.utc),
            distance=40,
            total_cost=400_000,
            savings=80_000,
            savings_rate=0.20,
        ),
        _snapshot(
            created_at=datetime(2026, 7, 30, 18, 30, tzinfo=timezone.utc),
            distance=60,
            total_cost=600_000,
            savings=90_000,
            savings_rate=0.15,
        ),
        _snapshot(
            created_at=datetime(2026, 7, 29, 12, tzinfo=timezone.utc),
            distance=50,
            total_cost=500_000,
            savings=100_000,
            savings_rate=0.20,
        ),
    ]

    response = build_analytics_history(
        snapshots,
        days=7,
        group_by="day",
        now=now,
    )

    assert [point.date for point in response.data_points] == [
        "2026-07-29",
        "2026-07-30",
        "2026-07-31",
    ]
    assert response.data_points[-1].optimization_runs == 1
    assert response.data_points[-1].total_distance_km == 60
    assert response.summary.total_optimizations == 3
    assert response.summary.total_cost_vnd == 1_500_000
    assert response.summary.avg_savings_rate == 0.1833
    assert response.summary.best_day == "2026-07-29"
    assert response.summary.best_day_savings_vnd == 100_000


def test_analytics_history_groups_weeks_by_monday() -> None:
    now = datetime(2026, 7, 31, 12, tzinfo=timezone.utc)
    snapshots = [
        _snapshot(
            created_at=now - timedelta(days=1),
            distance=40,
            total_cost=400_000,
            savings=80_000,
            savings_rate=0.20,
        ),
        _snapshot(
            created_at=now - timedelta(days=8),
            distance=50,
            total_cost=500_000,
            savings=90_000,
            savings_rate=0.18,
        ),
    ]

    response = build_analytics_history(
        snapshots,
        days=30,
        group_by="week",
        now=now,
    )

    assert [point.date for point in response.data_points] == [
        "2026-07-20",
        "2026-07-27",
    ]
    assert response.summary.total_optimizations == 2


def test_analytics_history_returns_zero_summary_for_empty_period() -> None:
    response = build_analytics_history(
        [],
        days=14,
        group_by="day",
        now=datetime(2026, 7, 31, tzinfo=timezone.utc),
    )

    assert response.data_points == []
    assert response.summary.period_label == "14 ngày gần nhất"
    assert response.summary.total_optimizations == 0
    assert response.summary.best_day is None
    assert response.summary.best_day_savings_vnd == 0


def test_seed_analytics_history_is_realistic_and_spans_the_demo_period() -> None:
    now = datetime(2026, 7, 31, 12, tzinfo=timezone.utc)

    snapshots = build_seed_analytics_snapshots(now=now)

    assert len(snapshots) == 25
    assert all(40 <= snapshot.total_distance_km <= 120 for snapshot in snapshots)
    assert all(0.15 <= snapshot.savings_rate <= 0.22 for snapshot in snapshots)
    assert min(snapshot.created_at for snapshot in snapshots) >= now - timedelta(days=30)
    assert max(snapshot.created_at for snapshot in snapshots) <= now


def test_seed_creates_analytics_history_once() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)

    with Session(engine) as db:
        first = seed_data(db)
        db.query(OrderActivityLog).delete()
        db.commit()
        second = seed_data(db)
        snapshot_count = db.scalar(
            select(func.count()).select_from(RouteAnalyticsSnapshot)
        )
        activity_count = db.scalar(
            select(func.count()).select_from(OrderActivityLog)
        )

    assert first.analytics_snapshots_created == 25
    assert second.analytics_snapshots_created == 0
    assert snapshot_count == 25
    assert activity_count == len(SEED_ORDERS)


def test_analytics_history_endpoint_queries_persisted_snapshots() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        dispatcher = User(
            email="analytics.dispatcher@test.vn",
            hashed_password=get_password_hash("123456"),
            full_name="Analytics Dispatcher",
            role=UserRole.DISPATCHER,
            status=UserStatus.ACTIVE,
        )
        db.add(dispatcher)
        db.add_all(
            build_seed_analytics_snapshots(
                now=datetime.now(timezone.utc),
                count=3,
            )
        )
        db.commit()
        response = get_analytics_history(
            db,
            dispatcher,
            days=30,
            group_by="day",
        )

    assert response.summary.total_optimizations == 3
    assert sum(point.optimization_runs for point in response.data_points) == 3


def test_analytics_role_policy_rejects_drivers() -> None:
    driver = User(
        email="analytics.driver@test.vn",
        hashed_password=get_password_hash("123456"),
        full_name="Analytics Driver",
        role=UserRole.DRIVER,
        status=UserStatus.ACTIVE,
    )
    analytics_role_policy = require_roles(UserRole.ADMIN, UserRole.DISPATCHER)

    with pytest.raises(HTTPException) as forbidden:
        analytics_role_policy(current_user=driver)

    assert forbidden.value.status_code == 403
