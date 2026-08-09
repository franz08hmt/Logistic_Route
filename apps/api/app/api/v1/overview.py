from fastapi import APIRouter, Depends
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from uuid import UUID

from app.db.models import (
    Order,
    OrderStatus,
    RouteAnalyticsSnapshot,
    Vehicle,
    VehicleStatus,
)
from app.db.session import get_db
from app.schemas import OverviewRead
from app.services.depot_scope import resolve_depot


router = APIRouter(tags=["overview"])


@router.get("/overview", response_model=OverviewRead)
def get_overview(
    db: Session = Depends(get_db),
    depot_id: UUID | None = None,
) -> OverviewRead:
    """Return live dashboard metrics derived from the current database state."""
    depot = resolve_depot(db, depot_id)
    order_scope = (
        [
            or_(Order.depot_id == depot.id, Order.depot_id.is_(None))
            if depot_id is None
            else Order.depot_id == depot.id
        ]
        if depot is not None
        else []
    )
    vehicle_scope = (
        [
            or_(Vehicle.depot_id == depot.id, Vehicle.depot_id.is_(None))
            if depot_id is None
            else Vehicle.depot_id == depot.id
        ]
        if depot is not None
        else []
    )
    analytics_scope = (
        [
            or_(
                RouteAnalyticsSnapshot.depot_id == depot.id,
                RouteAnalyticsSnapshot.depot_id.is_(None),
            )
            if depot_id is None
            else RouteAnalyticsSnapshot.depot_id == depot.id
        ]
        if depot is not None
        else []
    )
    active_orders_count = db.scalar(
        select(func.count(Order.id)).where(
            *order_scope,
            Order.status.in_([
                OrderStatus.PENDING,
                OrderStatus.ASSIGNED,
                OrderStatus.DELIVERING,
            ])
        )
    ) or 0
    assigned_orders_count = db.scalar(
        select(func.count(Order.id)).where(
            *order_scope,
            Order.status == OrderStatus.ASSIGNED,
        )
    ) or 0
    delivered_orders_count = db.scalar(
        select(func.count(Order.id)).where(
            *order_scope,
            Order.status == OrderStatus.DELIVERED,
        )
    ) or 0
    failed_orders_count = db.scalar(
        select(func.count(Order.id)).where(
            *order_scope,
            Order.status == OrderStatus.FAILED,
        )
    ) or 0
    vehicles_count = db.scalar(
        select(func.count(Vehicle.id)).where(*vehicle_scope)
    ) or 0
    drivers_online_count = db.scalar(
        select(func.count(Vehicle.id)).where(
            *vehicle_scope,
            Vehicle.status == VehicleStatus.ON_ROUTE,
            Vehicle.driver_name.is_not(None),
            func.trim(Vehicle.driver_name) != "",
        )
    ) or 0

    # A dedicated route entity will replace this proxy when route planning lands.
    routes_optimized_count = db.scalar(
        select(func.count(Order.id)).where(
            *order_scope,
            Order.status == OrderStatus.ASSIGNED,
        )
    ) or 0
    latest_analytics = db.scalar(
        select(RouteAnalyticsSnapshot)
        .where(*analytics_scope)
        .order_by(
            RouteAnalyticsSnapshot.created_at.desc(),
            RouteAnalyticsSnapshot.id.desc(),
        )
        .limit(1)
    )

    return OverviewRead(
        active_orders_count=active_orders_count,
        assigned_orders_count=assigned_orders_count,
        delivered_orders_count=delivered_orders_count,
        failed_orders_count=failed_orders_count,
        vehicles_count=vehicles_count,
        drivers_online_count=drivers_online_count,
        routes_optimized_count=routes_optimized_count,
        estimated_operating_cost_vnd=(
            latest_analytics.total_cost_vnd if latest_analytics else 0
        ),
        estimated_savings_vnd=(
            latest_analytics.estimated_savings_vnd if latest_analytics else 0
        ),
        co2_emissions_kg=(
            latest_analytics.co2_emissions_kg if latest_analytics else 0
        ),
        estimated_co2_savings_kg=(
            latest_analytics.estimated_co2_savings_kg if latest_analytics else 0
        ),
    )
