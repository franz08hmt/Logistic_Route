from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Order, OrderStatus, Vehicle, VehicleStatus
from app.db.session import get_db
from app.schemas import OverviewRead


router = APIRouter(tags=["overview"])


@router.get("/overview", response_model=OverviewRead)
def get_overview(db: Session = Depends(get_db)) -> OverviewRead:
    """Return live dashboard metrics derived from the current database state."""
    active_orders_count = db.scalar(
        select(func.count(Order.id)).where(Order.status != OrderStatus.DELIVERED)
    ) or 0
    vehicles_count = db.scalar(select(func.count(Vehicle.id))) or 0
    drivers_online_count = db.scalar(
        select(func.count(Vehicle.id)).where(
            Vehicle.status == VehicleStatus.ON_ROUTE,
            Vehicle.driver_name.is_not(None),
            func.trim(Vehicle.driver_name) != "",
        )
    ) or 0

    # A dedicated route entity will replace this proxy when route planning lands.
    routes_optimized_count = db.scalar(
        select(func.count(Order.id)).where(Order.status == OrderStatus.ASSIGNED)
    ) or 0

    return OverviewRead(
        active_orders_count=active_orders_count,
        vehicles_count=vehicles_count,
        drivers_online_count=drivers_online_count,
        routes_optimized_count=routes_optimized_count,
    )
