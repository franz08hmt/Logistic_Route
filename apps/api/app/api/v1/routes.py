from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import require_roles
from app.db.models import User, UserRole
from app.schemas import DepotRead, RouteCostMetrics, RouteOptimizationResponse
from app.services.route_optimization import (
    RouteOptimizationError,
    optimize_pending_routes,
)


router = APIRouter(prefix="/routes", tags=["route-optimization"])


@router.post("/optimize", response_model=RouteOptimizationResponse)
def optimize_routes(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DISPATCHER)),
) -> RouteOptimizationResponse:
    """Optimize all pending and failed orders using the configured depot and fleet."""
    try:
        run = optimize_pending_routes(db)
    except RouteOptimizationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    return RouteOptimizationResponse(
        depot=DepotRead.model_validate(run.depot),
        cost_metrics=RouteCostMetrics.model_validate(
            run.cost_metrics,
            from_attributes=True,
        ),
        **run.result.model_dump(),
    )
