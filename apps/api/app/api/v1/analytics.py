from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.models import RouteAnalyticsSnapshot, User, UserRole
from app.db.session import get_db
from app.schemas import AnalyticsHistoryResponse
from app.services.analytics_history import (
    analytics_window_start,
    build_analytics_history,
)


router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/history", response_model=AnalyticsHistoryResponse)
def get_analytics_history(
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[
        User,
        Depends(require_roles(UserRole.ADMIN, UserRole.DISPATCHER)),
    ],
    days: Annotated[int, Query(ge=1, le=90)] = 30,
    group_by: Annotated[Literal["day", "week"], Query()] = "day",
) -> AnalyticsHistoryResponse:
    """Return server-side aggregated route analytics for the selected period."""
    snapshots = list(
        db.scalars(
            select(RouteAnalyticsSnapshot)
            .where(
                RouteAnalyticsSnapshot.created_at
                >= analytics_window_start(days=days)
            )
            .order_by(RouteAnalyticsSnapshot.created_at)
        ).all()
    )
    return build_analytics_history(
        snapshots,
        days=days,
        group_by=group_by,
    )
