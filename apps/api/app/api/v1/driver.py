from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.core.config import POD_PUBLIC_BASE_URL, POD_UPLOAD_DIR
from app.db.models import Depot, Order, OrderStatus, User, UserRole, Vehicle
from app.db.session import get_db
from app.schemas import (
    DepotRead,
    DriverOrderStatusUpdate,
    DriverRouteRead,
    DriverStopRead,
    DriverVehicleRead,
    PodUploadRead,
)
from app.services.pod_storage import MAX_POD_BYTES, store_pod_content
from app.services.driver_availability import reconcile_vehicle_availability


router = APIRouter(prefix="/driver", tags=["driver"])


async def _read_limited_pod_body(request: Request) -> bytes:
    """Read an upload without allowing an omitted Content-Length to bypass 5 MB."""
    content = bytearray()
    async for chunk in request.stream():
        if len(content) + len(chunk) > MAX_POD_BYTES:
            raise HTTPException(
                status_code=413,
                detail="POD image exceeds the 5 MB limit",
            )
        content.extend(chunk)
    return bytes(content)


def _driver_vehicle(
    db: Session,
    current_user: User,
    *,
    for_update: bool = False,
) -> Vehicle | None:
    statement = (
        select(Vehicle)
        .where(Vehicle.driver_id == current_user.id)
        .order_by(Vehicle.license_plate)
        .limit(1)
    )
    if for_update:
        statement = statement.with_for_update()
    return db.scalar(statement)


@router.post(
    "/orders/{order_id}/pod",
    response_model=PodUploadRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_order_pod(
    order_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DRIVER)),
) -> PodUploadRead:
    vehicle = _driver_vehicle(db, current_user)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="No vehicle is assigned")
    order = db.scalar(
        select(Order).where(
            Order.id == order_id,
            Order.assigned_vehicle_id == vehicle.id,
        )
    )
    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Order is not assigned to this driver",
        )

    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_POD_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail="POD image exceeds the 5 MB limit",
                )
        except ValueError as error:
            raise HTTPException(
                status_code=400,
                detail="Invalid Content-Length header",
            ) from error

    content_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
    content = await _read_limited_pod_body(request)
    try:
        filename, size_bytes = store_pod_content(
            content=content,
            content_type=content_type,
            order_id=order.id,
            upload_dir=POD_UPLOAD_DIR,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    return PodUploadRead(
        pod_url=f"{POD_PUBLIC_BASE_URL}/uploads/pod/{filename}",
        content_type=content_type,
        size_bytes=size_bytes,
    )


@router.get("/route", response_model=DriverRouteRead)
def get_driver_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DRIVER)),
) -> DriverRouteRead:
    vehicle = _driver_vehicle(db, current_user)
    depot = db.scalar(select(Depot).order_by(Depot.name, Depot.id).limit(1))
    if vehicle is None:
        return DriverRouteRead(
            vehicle=None,
            depot=DepotRead.model_validate(depot) if depot else None,
            total_orders=0,
            completed_orders=0,
            stops=[],
        )
    if depot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No depot is configured",
        )

    orders = list(
        db.scalars(
            select(Order)
            .where(Order.assigned_vehicle_id == vehicle.id)
            .order_by(Order.stop_sequence.nulls_last(), Order.order_code)
        ).all()
    )

    return DriverRouteRead(
        vehicle=DriverVehicleRead.model_validate(vehicle),
        depot=DepotRead.model_validate(depot),
        total_orders=len(orders),
        completed_orders=sum(
            order.status is OrderStatus.DELIVERED for order in orders
        ),
        stops=[DriverStopRead.model_validate(order) for order in orders],
    )


@router.patch("/orders/{order_id}/status", response_model=DriverStopRead)
def update_driver_order_status(
    order_id: UUID,
    payload: DriverOrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DRIVER)),
) -> Order:
    # Lock the vehicle first so two stops completed concurrently cannot both
    # calculate availability from an inconsistent set of active orders.
    vehicle = _driver_vehicle(db, current_user, for_update=True)
    if vehicle is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No vehicle is assigned to this driver",
        )
    order = db.scalar(
        select(Order).where(
            Order.id == order_id,
            Order.assigned_vehicle_id == vehicle.id,
        ).with_for_update()
    )
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order is not assigned to this driver",
        )

    terminal_statuses = {OrderStatus.DELIVERED, OrderStatus.FAILED}
    requested_status = OrderStatus(payload.status.value)
    if order.status in terminal_statuses and order.status is not requested_status:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A completed delivery cannot be moved back to another status",
        )

    effective_pod_url = payload.pod_url or order.pod_url
    if requested_status is OrderStatus.DELIVERED and not effective_pod_url:
        raise HTTPException(
            status_code=422,
            detail="Proof of delivery image is required for a delivered order",
        )
    if requested_status is OrderStatus.FAILED and not payload.failure_reason:
        raise HTTPException(
            status_code=422,
            detail="Failure reason is required for a failed delivery",
        )

    order.status = requested_status
    order.delivery_note = payload.delivery_note
    order.failure_reason = (
        payload.failure_reason if requested_status is OrderStatus.FAILED else None
    )
    order.pod_url = effective_pod_url
    db.flush()
    reconcile_vehicle_availability(db, vehicle)
    # Order status and vehicle availability are committed atomically.
    db.commit()
    db.refresh(order)
    return order
