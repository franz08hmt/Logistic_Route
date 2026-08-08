from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.core.config import (
    POD_PUBLIC_BASE_URL,
    POD_UPLOAD_DIR,
    SIGNATURE_PUBLIC_BASE_URL,
    SIGNATURE_UPLOAD_DIR,
)
from app.db.models import Depot, Order, OrderStatus, User, UserRole, Vehicle
from app.db.session import get_db
from app.schemas import (
    DepotRead,
    DriverTelemetryPing,
    DriverOrderStatusUpdate,
    DriverRouteRead,
    DriverStopRead,
    DriverVehicleRead,
    PodUploadRead,
    SignatureUploadRead,
    VehicleTelemetryItem,
)
from app.services.pod_storage import MAX_POD_BYTES, store_pod_content
from app.services.signature_storage import MAX_SIGNATURE_BYTES, store_signature_content
from app.services.activity_logger import log_order_activity
from app.services.driver_availability import (
    ACTIVE_ROUTE_STATUSES,
    reconcile_vehicle_availability,
)
from app.services.order_status import set_order_status
from app.services.notification_service import (
    notification_template_for_status,
    send_order_notification,
)
from app.services.telemetry import (
    calculate_vehicle_deviation_status,
    find_next_active_stop,
)


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


@router.patch("/telemetry", response_model=VehicleTelemetryItem)
def update_driver_telemetry(
    payload: DriverTelemetryPing,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DRIVER)),
) -> VehicleTelemetryItem:
    vehicle = _driver_vehicle(db, current_user, for_update=True)
    if vehicle is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No vehicle is assigned to this driver",
        )

    next_stop = find_next_active_stop(db, vehicle.id)
    vehicle.current_latitude = payload.latitude
    vehicle.current_longitude = payload.longitude
    vehicle.current_speed_kmh = payload.speed_kmh or 0.0
    vehicle.last_gps_ping_at = datetime.now(timezone.utc)
    vehicle.route_deviation_status = calculate_vehicle_deviation_status(
        db,
        vehicle=vehicle,
        latitude=payload.latitude,
        longitude=payload.longitude,
        next_stop=next_stop,
    )
    db.commit()
    db.refresh(vehicle)

    return VehicleTelemetryItem(
        vehicle_id=vehicle.id,
        license_plate=vehicle.license_plate,
        driver_name=vehicle.driver_name or current_user.full_name,
        status=vehicle.status,
        current_latitude=vehicle.current_latitude,
        current_longitude=vehicle.current_longitude,
        speed_kmh=vehicle.current_speed_kmh,
        last_gps_ping_at=vehicle.last_gps_ping_at,
        route_deviation_status=vehicle.route_deviation_status,
        next_stop_address=next_stop.address if next_stop else None,
        next_stop_sequence=next_stop.stop_sequence if next_stop else None,
    )


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

    pod_url = f"{POD_PUBLIC_BASE_URL}/uploads/pod/{filename}"
    order.pod_url = pod_url
    order.pod_uploaded_at = datetime.now(timezone.utc)
    db.flush()
    log_order_activity(
        db,
        order_id=order.id,
        action="POD_UPLOADED",
        actor=current_user,
        detail="POD uploaded",
    )
    db.commit()

    return PodUploadRead(
        pod_url=pod_url,
        content_type=content_type,
        size_bytes=size_bytes,
    )


@router.post(
    "/orders/{order_id}/signature",
    response_model=SignatureUploadRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_order_signature(
    order_id: UUID,
    file: UploadFile = File(...),
    recipient_name: str = Form(..., min_length=1, max_length=150),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DRIVER)),
) -> SignatureUploadRead:
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

    normalized_recipient_name = recipient_name.strip()
    if not normalized_recipient_name or len(normalized_recipient_name) > 150:
        raise HTTPException(
            status_code=422,
            detail="Recipient name must contain 1 to 150 characters",
        )

    try:
        content = await file.read(MAX_SIGNATURE_BYTES + 1)
    finally:
        await file.close()
    if len(content) > MAX_SIGNATURE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Signature PNG exceeds the 1 MB limit",
        )

    content_type = (file.content_type or "").split(";", 1)[0].lower()
    try:
        filename = store_signature_content(
            content=content,
            content_type=content_type,
            order_id=order.id,
            upload_dir=SIGNATURE_UPLOAD_DIR,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    uploaded_at = datetime.now(timezone.utc)
    signature_url = (
        f"{SIGNATURE_PUBLIC_BASE_URL}/uploads/signatures/{filename}"
    )
    order.signature_url = signature_url
    order.signature_uploaded_at = uploaded_at
    order.recipient_name = normalized_recipient_name
    db.flush()
    log_order_activity(
        db,
        order_id=order.id,
        action="SIGNATURE_UPLOADED",
        actor=current_user,
        detail=f"Recipient signature uploaded for {normalized_recipient_name}",
    )
    db.commit()

    return SignatureUploadRead(
        signature_url=signature_url,
        uploaded_at=uploaded_at,
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

    active_order = db.scalar(
        select(Order)
        .where(
            Order.assigned_vehicle_id == vehicle.id,
            Order.status.in_(ACTIVE_ROUTE_STATUSES),
        )
        .order_by(Order.stop_sequence.nulls_last(), Order.order_code)
        .limit(1)
    )
    if active_order is None:
        return DriverRouteRead(
            vehicle=DriverVehicleRead.model_validate(vehicle),
            depot=DepotRead.model_validate(depot),
            total_orders=0,
            completed_orders=0,
            stops=[],
        )

    current_statuses = (*ACTIVE_ROUTE_STATUSES, OrderStatus.DELIVERED, OrderStatus.FAILED)
    route_filter = (
        Order.route_batch_id == active_order.route_batch_id
        if active_order.route_batch_id is not None
        else Order.status.in_(ACTIVE_ROUTE_STATUSES)
    )
    orders = list(
        db.scalars(
            select(Order)
            .where(
                Order.assigned_vehicle_id == vehicle.id,
                Order.status.in_(current_statuses),
                route_filter,
            )
            .order_by(Order.stop_sequence.nulls_last(), Order.order_code)
        ).all()
    )

    return DriverRouteRead(
        vehicle=DriverVehicleRead.model_validate(vehicle),
        depot=DepotRead.model_validate(depot),
        total_orders=len(orders),
        completed_orders=sum(
            order.status in {OrderStatus.DELIVERED, OrderStatus.FAILED}
            for order in orders
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

    old_status = order.status.value
    set_order_status(order, requested_status)
    order.delivery_note = payload.delivery_note
    order.failure_reason = (
        payload.failure_reason if requested_status is OrderStatus.FAILED else None
    )
    order.pod_url = effective_pod_url
    if effective_pod_url and order.pod_uploaded_at is None:
        order.pod_uploaded_at = datetime.now(timezone.utc)
    db.flush()
    log_order_activity(
        db,
        order_id=order.id,
        action="STATUS_CHANGED",
        actor=current_user,
        old_status=old_status,
        new_status=requested_status.value,
        detail=(
            order.failure_reason
            if requested_status is OrderStatus.FAILED
            else order.delivery_note
        ),
    )
    template_code = notification_template_for_status(requested_status)
    if old_status != requested_status.value and template_code is not None:
        send_order_notification(
            db,
            order=order,
            template_code=template_code,
            vehicle=vehicle,
            driver=current_user,
        )
    reconcile_vehicle_availability(db, vehicle)
    # Order status and vehicle availability are committed atomically.
    db.commit()
    db.refresh(order)
    return order
