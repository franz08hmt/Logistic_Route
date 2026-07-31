from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import require_roles
from app.db.models import User, UserRole
from app.schemas import DepotRead, RouteCostMetrics, RouteOptimizationResponse
from app.schemas import (
    MultiStopDispatchRequest,
    MultiStopDispatchResponse,
    MultiStopDispatchStop,
)
from app.services.dispatch_optimization import (
    MultiStopDispatchError,
    dispatch_optimized_route,
)
from app.services.route_optimization import (
    RouteOptimizationError,
    optimize_pending_routes,
)


router = APIRouter(prefix="/routes", tags=["route-optimization"])


@router.post("/dispatch", response_model=MultiStopDispatchResponse)
def dispatch_multi_stop_route(
    payload: MultiStopDispatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DISPATCHER)),
) -> MultiStopDispatchResponse:
    """Optimize and atomically assign an explicitly selected set of pending orders."""
    try:
        run = dispatch_optimized_route(
            db,
            order_ids=payload.order_ids,
            driver_id=payload.driver_id,
            force_region_mismatch=payload.force_region_mismatch,
            actor=current_user,
        )
    except MultiStopDispatchError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    route = run.result.routes[0]
    stops = []
    for stop in route.stops:
        order = run.orders_by_id[UUID(stop.order_id)]
        stops.append(
            MultiStopDispatchStop(
                order_id=order.id,
                order_code=order.order_code,
                stop_sequence=stop.stop_sequence,
                customer_name=order.customer_name,
                address=order.address,
                latitude=order.latitude,
                longitude=order.longitude,
                weight_kg=order.weight_kg,
            )
        )

    return MultiStopDispatchResponse(
        status=run.result.status,
        route_batch_id=run.route_batch_id,
        driver_id=run.driver.id,
        driver_name=run.driver.full_name,
        vehicle_id=run.vehicle.id,
        license_plate=run.vehicle.license_plate,
        depot=DepotRead.model_validate(run.depot),
        total_distance_km=run.result.total_distance_km,
        total_duration_mins=run.result.total_duration_mins,
        total_weight_kg=route.total_weight_kg,
        cost_metrics=RouteCostMetrics.model_validate(
            run.cost_metrics,
            from_attributes=True,
        ),
        stops=stops,
    )


@router.post("/optimize", response_model=RouteOptimizationResponse)
def optimize_routes(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DISPATCHER)),
) -> RouteOptimizationResponse:
    """Optimize all pending and failed orders using the configured depot and fleet."""
    try:
        run = optimize_pending_routes(db, actor=current_user)
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
