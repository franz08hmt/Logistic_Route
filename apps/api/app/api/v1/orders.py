import csv
import io
import logging
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Path, Response, UploadFile, status
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import (
    CustomerNotification,
    Depot,
    Order,
    OrderActivityLog,
    OrderStatus,
    User,
    UserRole,
    UserStatus,
    Vehicle,
    VehicleStatus,
)
from app.db.session import get_db
from app.core.security import get_current_user, require_roles
from app.schemas import (
    BulkImportResponse,
    BulkImportRowError,
    CustomerNotificationRead,
    DepotRead,
    OrderCreate,
    OrderActivityListResponse,
    OrderActivityRead,
    OrderDispatchRequest,
    OrderRead,
    OrderStatusUpdate,
    NotificationResendRequest,
    PublicTrackingDriver,
    PublicTrackingOrder,
    PublicTrackingResponse,
)
from app.services.activity_logger import log_order_activity
from app.services.driver_availability import (
    reconcile_vehicle_availability,
    vehicle_is_available_clause,
)
from app.services.order_status import set_order_status
from app.services.notification_service import (
    ORDER_ASSIGNED,
    notification_template_for_status,
    send_order_notification,
)
from app.services.public_tracking import (
    estimate_arrival_minutes,
    generate_tracking_token,
    mask_customer_name,
    mask_phone_number,
)
from app.services.region_matcher import regions_match


router = APIRouter(prefix="/orders", tags=["orders"])
public_router = APIRouter(prefix="/public", tags=["public-tracking"])
logger = logging.getLogger(__name__)

MAX_CSV_IMPORT_BYTES = 2 * 1024 * 1024
CSV_IMPORT_COLUMNS = (
    "order_code",
    "customer_name",
    "customer_phone",
    "address",
    "latitude",
    "longitude",
    "weight_kg",
    "delivery_region",
)
CSV_REQUIRED_COLUMNS = {
    "order_code",
    "customer_name",
    "address",
    "latitude",
    "longitude",
    "weight_kg",
}


def _format_validation_errors(error: ValidationError) -> list[str]:
    formatted: list[str] = []
    for issue in error.errors(include_url=False):
        location = ".".join(str(part) for part in issue["loc"])
        formatted.append(f"{location}: {issue['msg']}")
    return formatted


def _normalized_csv_row(row: dict[str | None, object]) -> dict[str, object]:
    values = {
        str(key).strip(): (value.strip() if isinstance(value, str) else "")
        for key, value in row.items()
        if key is not None
    }
    return {
        "order_code": values.get("order_code", ""),
        "customer_name": values.get("customer_name", ""),
        "customer_phone": values.get("customer_phone") or None,
        "address": values.get("address", ""),
        "latitude": values.get("latitude", ""),
        "longitude": values.get("longitude", ""),
        "weight_kg": values.get("weight_kg", ""),
        "delivery_region": values.get("delivery_region") or None,
    }


def _csv_row_has_content(row: dict[str | None, object]) -> bool:
    for value in row.values():
        if isinstance(value, list):
            if any(str(item).strip() for item in value):
                return True
        elif value is not None and str(value).strip():
            return True
    return False


def _build_import_template() -> bytes:
    stream = io.StringIO(newline="")
    writer = csv.writer(stream, lineterminator="\r\n")
    writer.writerow(CSV_IMPORT_COLUMNS)
    writer.writerows(
        [
            (
                "LR-IMPORT-001",
                "Nguyễn Văn A",
                "0901234567",
                "123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM",
                "10.7769",
                "106.7009",
                "15.5",
                "Trung tâm TP.HCM",
            ),
            (
                "LR-IMPORT-002",
                "Trần Thị B",
                "",
                "456 Lê Lợi, Phường Bến Thành, Quận 1, TP.HCM",
                "10.7736",
                "106.6984",
                "8.0",
                "",
            ),
            (
                "LR-IMPORT-003",
                "Lê Minh C",
                "0912345678",
                "12 Võ Văn Ngân, Phường Linh Chiểu, TP. Thủ Đức",
                "10.8496",
                "106.7719",
                "22.0",
                "TP. Thủ Đức",
            ),
        ]
    )
    return ("\ufeff" + stream.getvalue()).encode("utf-8")


@router.get("", response_model=list[OrderRead])
def list_orders(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> list[Order]:
    return list(db.scalars(select(Order).order_by(Order.order_code)).all())


@router.post("", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
def create_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DISPATCHER)),
) -> Order:
    existing = db.scalar(select(Order).where(Order.order_code == payload.order_code))
    if existing:
        raise HTTPException(status_code=409, detail="order_code already exists")

    # Creation is deliberately side-effect free for dispatch state. Assignment
    # only happens through POST /orders/{id}/dispatch.
    order = Order(
        **payload.model_dump(exclude={"status"}),
        tracking_token=generate_tracking_token(),
        status=OrderStatus.PENDING,
        assigned_vehicle_id=None,
        route_batch_id=None,
        stop_sequence=None,
    )
    db.add(order)
    try:
        db.flush()
        log_order_activity(
            db,
            order_id=order.id,
            action="CREATED",
            actor=_current_user,
            new_status=OrderStatus.PENDING.value,
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="order_code already exists") from exc
    db.refresh(order)
    logger.info("order_created order_id=%s status=PENDING", order.id)
    return order


@router.get("/import/template", response_class=Response)
def download_order_import_template(
    _current_user: User = Depends(
        require_roles(UserRole.ADMIN, UserRole.DISPATCHER)
    ),
) -> Response:
    return Response(
        content=_build_import_template(),
        media_type="text/csv",
        headers={
            "Content-Disposition": (
                'attachment; filename="logiroute-order-import-template.csv"'
            ),
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.post(
    "/import",
    response_model=BulkImportResponse,
    status_code=status.HTTP_200_OK,
)
async def import_orders(
    file: Annotated[UploadFile, File(description="UTF-8 CSV file, maximum 2 MB")],
    db: Session = Depends(get_db),
    _current_user: User = Depends(
        require_roles(UserRole.ADMIN, UserRole.DISPATCHER)
    ),
) -> BulkImportResponse:
    filename = (file.filename or "").strip()
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="file must use the .csv extension")

    body = await file.read(MAX_CSV_IMPORT_BYTES + 1)
    await file.close()
    if len(body) > MAX_CSV_IMPORT_BYTES:
        raise HTTPException(status_code=413, detail="CSV file exceeds the 2 MB limit")
    if not body:
        raise HTTPException(status_code=400, detail="CSV file is empty")

    try:
        decoded = body.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail="CSV file must be UTF-8 encoded",
        ) from exc

    try:
        reader = csv.DictReader(io.StringIO(decoded, newline=""))
        raw_fieldnames = reader.fieldnames
    except csv.Error as exc:
        raise HTTPException(status_code=400, detail="CSV file is malformed") from exc

    if not raw_fieldnames:
        raise HTTPException(status_code=400, detail="CSV header is required")

    normalized_headers = [header.strip() for header in raw_fieldnames]
    if len(normalized_headers) != len(set(normalized_headers)):
        raise HTTPException(status_code=400, detail="CSV header contains duplicates")
    reader.fieldnames = normalized_headers

    missing_columns = sorted(CSV_REQUIRED_COLUMNS - set(normalized_headers))
    if missing_columns:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "CSV is missing required columns",
                "missing_columns": missing_columns,
            },
        )

    try:
        rows = [row for row in reader if _csv_row_has_content(row)]
    except csv.Error as exc:
        raise HTTPException(status_code=400, detail="CSV file is malformed") from exc
    if not rows:
        raise HTTPException(status_code=400, detail="CSV file contains no data rows")

    parsed_rows: list[tuple[int, str | None, OrderCreate | None, list[str]]] = []
    codes_seen: set[str] = set()
    candidate_codes: set[str] = set()
    for row_number, raw_row in enumerate(rows, start=1):
        normalized = _normalized_csv_row(raw_row)
        order_code_value = normalized["order_code"]
        order_code = (
            str(order_code_value).strip()
            if order_code_value is not None and str(order_code_value).strip()
            else None
        )
        extra_values = raw_row.get(None)
        row_errors: list[str] = (
            ["row contains more values than the CSV header"]
            if isinstance(extra_values, list)
            and any(str(value).strip() for value in extra_values)
            else []
        )
        if order_code and order_code in codes_seen:
            row_errors.append("duplicate order_code in CSV")
        if order_code:
            codes_seen.add(order_code)
            candidate_codes.add(order_code)

        payload: OrderCreate | None = None
        if not row_errors:
            try:
                payload = OrderCreate.model_validate(normalized)
            except ValidationError as exc:
                row_errors.extend(_format_validation_errors(exc))
        parsed_rows.append((row_number, order_code, payload, row_errors))

    existing_codes = set(
        db.scalars(
            select(Order.order_code).where(Order.order_code.in_(candidate_codes))
        ).all()
    )
    errors: list[BulkImportRowError] = []
    created_count = 0
    for row_number, order_code, payload, row_errors in parsed_rows:
        if not row_errors and order_code in existing_codes:
            row_errors.append("order_code already exists")
        if row_errors or payload is None:
            errors.append(
                BulkImportRowError(
                    row=row_number,
                    order_code=order_code,
                    errors=row_errors or ["row could not be parsed"],
                )
            )
            continue

        order = Order(
            **payload.model_dump(exclude={"status"}),
            tracking_token=generate_tracking_token(),
            status=OrderStatus.PENDING,
            assigned_vehicle_id=None,
            route_batch_id=None,
            stop_sequence=None,
        )
        db.add(order)
        try:
            db.flush()
            log_order_activity(
                db,
                order_id=order.id,
                action="IMPORTED",
                actor=_current_user,
                new_status=OrderStatus.PENDING.value,
                detail="Imported from CSV",
            )
            db.commit()
        except IntegrityError:
            db.rollback()
            errors.append(
                BulkImportRowError(
                    row=row_number,
                    order_code=order_code,
                    errors=["order_code already exists"],
                )
            )
            continue
        created_count += 1
        existing_codes.add(payload.order_code)

    logger.info(
        "orders_csv_imported filename=%s total=%s created=%s errors=%s",
        filename,
        len(rows),
        created_count,
        len(errors),
    )
    return BulkImportResponse(
        total_rows=len(rows),
        created_count=created_count,
        error_count=len(errors),
        errors=errors,
    )


@public_router.get(
    "/track/{tracking_token}",
    response_model=PublicTrackingResponse,
)
def get_public_tracking(
    tracking_token: Annotated[
        str,
        Path(min_length=32, max_length=64, pattern=r"^[A-Za-z0-9_-]+$"),
    ],
    db: Session = Depends(get_db),
) -> PublicTrackingResponse:
    """Return a privacy-reduced tracking view without requiring authentication."""
    order = db.scalar(select(Order).where(Order.tracking_token == tracking_token))
    if order is None:
        raise HTTPException(status_code=404, detail="Tracking information not found")

    depot = db.scalar(select(Depot).order_by(Depot.id).limit(1))
    if depot is None:
        raise HTTPException(
            status_code=503,
            detail="Tracking information is temporarily unavailable",
        )

    driver_payload: PublicTrackingDriver | None = None
    if (
        order.status in {OrderStatus.ASSIGNED, OrderStatus.DELIVERING}
        and order.assigned_vehicle_id is not None
    ):
        vehicle = db.scalar(
            select(Vehicle).where(Vehicle.id == order.assigned_vehicle_id)
        )
        if vehicle is not None:
            driver = (
                db.scalar(select(User).where(User.id == vehicle.driver_id))
                if vehicle.driver_id is not None
                else None
            )
            driver_name = (
                driver.full_name
                if driver is not None
                else vehicle.driver_name or "LogiRoute Driver"
            )
            driver_payload = PublicTrackingDriver(
                driver_name=driver_name,
                driver_phone=mask_phone_number(
                    driver.phone_number if driver is not None else None
                ),
                license_plate=vehicle.license_plate,
                vehicle_type=vehicle.vehicle_type,
            )

    stops_remaining_before = 0
    if (
        order.status in {OrderStatus.ASSIGNED, OrderStatus.DELIVERING}
        and order.route_batch_id is not None
        and order.assigned_vehicle_id is not None
        and order.stop_sequence is not None
    ):
        stops_remaining_before = int(
            db.scalar(
                select(func.count())
                .select_from(Order)
                .where(
                    Order.route_batch_id == order.route_batch_id,
                    Order.assigned_vehicle_id == order.assigned_vehicle_id,
                    Order.stop_sequence < order.stop_sequence,
                    Order.status.in_((OrderStatus.ASSIGNED, OrderStatus.DELIVERING)),
                )
            )
            or 0
        )

    return PublicTrackingResponse(
        order=PublicTrackingOrder(
            order_code=order.order_code,
            customer_name_masked=mask_customer_name(order.customer_name),
            customer_phone_masked=mask_phone_number(order.customer_phone),
            address=order.address,
            latitude=order.latitude,
            longitude=order.longitude,
            status=order.status,
            status_updated_at=order.status_updated_at,
            delivery_note=order.delivery_note,
            failure_reason=order.failure_reason,
        ),
        depot=DepotRead.model_validate(depot),
        driver=driver_payload,
        stops_remaining_before=stops_remaining_before,
        route_batch_id=order.route_batch_id,
        estimated_arrival_minutes=estimate_arrival_minutes(
            order.status.value,
            stops_remaining_before,
        ),
    )


@router.post("/{order_id}/dispatch", response_model=OrderRead)
def dispatch_order(
    order_id: UUID,
    payload: OrderDispatchRequest,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DISPATCHER)),
) -> Order:
    """Explicitly assign one pending/failed order to a ready driver's vehicle."""
    order = db.scalar(
        select(Order).where(Order.id == order_id).with_for_update()
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status not in {OrderStatus.PENDING, OrderStatus.FAILED}:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "ORDER_NOT_DISPATCHABLE",
                "message": "Only PENDING or FAILED orders can be dispatched",
            },
        )

    row = db.execute(
        select(User, Vehicle)
        .join(Vehicle, Vehicle.driver_id == User.id)
        .where(
            User.id == payload.driver_id,
            User.role == UserRole.DRIVER,
            User.status == UserStatus.ACTIVE,
            vehicle_is_available_clause(),
        )
        .with_for_update()
        .limit(1)
    ).first()
    if row is None:
        logger.warning(
            "order_dispatch_rejected order_id=%s driver_id=%s reason=not_ready",
            order.id,
            payload.driver_id,
        )
        raise HTTPException(
            status_code=409,
            detail={
                "code": "DRIVER_NOT_READY",
                "message": "Selected driver is not ready for assignment",
            },
        )

    driver, vehicle = row
    if order.weight_kg > vehicle.capacity_kg:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "VEHICLE_CAPACITY_EXCEEDED",
                "message": "Order weight exceeds the selected vehicle capacity",
            },
        )

    if (
        order.delivery_region
        and vehicle.service_area
        and not regions_match(order.delivery_region, vehicle.service_area)
        and not payload.force_region_mismatch
    ):
        raise HTTPException(
            status_code=409,
            detail={
                "code": "REGION_MISMATCH",
                "message": (
                    f"Driver {driver.full_name} serves {vehicle.service_area}, "
                    f"but this delivery is in {order.delivery_region}"
                ),
                "driver_name": driver.full_name,
                "driver_region": vehicle.service_area,
                "delivery_region": order.delivery_region,
            },
        )

    old_status = order.status.value
    order.assigned_vehicle_id = vehicle.id
    order.route_batch_id = uuid4()
    order.stop_sequence = 1
    set_order_status(order, OrderStatus.ASSIGNED)
    order.failure_reason = None
    vehicle.status = VehicleStatus.ON_ROUTE
    try:
        db.flush()
        log_order_activity(
            db,
            order_id=order.id,
            action="ASSIGNED",
            actor=_current_user,
            old_status=old_status,
            new_status=OrderStatus.ASSIGNED.value,
            detail=f"Gán cho xe {vehicle.license_plate} · {driver.full_name}",
        )
        send_order_notification(
            db,
            order=order,
            template_code=ORDER_ASSIGNED,
            vehicle=vehicle,
            driver=driver,
        )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception(
            "order_dispatch_failed order_id=%s driver_id=%s",
            order.id,
            payload.driver_id,
        )
        raise
    db.refresh(order)
    logger.info(
        "order_dispatched order_id=%s driver_id=%s vehicle_id=%s batch_id=%s",
        order.id,
        driver.id,
        vehicle.id,
        order.route_batch_id,
    )
    return order


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(
    order_id: UUID,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DISPATCHER)),
) -> Response:
    order = db.scalar(select(Order).where(Order.id == order_id).with_for_update())
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    vehicle = (
        db.scalar(
            select(Vehicle)
            .where(Vehicle.id == order.assigned_vehicle_id)
            .with_for_update()
        )
        if order.assigned_vehicle_id is not None
        else None
    )
    db.delete(order)
    db.flush()
    if vehicle is not None:
        reconcile_vehicle_availability(db, vehicle)
    db.commit()
    logger.info("order_deleted order_id=%s", order_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{order_id}/activity", response_model=OrderActivityListResponse)
def get_order_activity(
    order_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OrderActivityListResponse:
    order = db.scalar(select(Order).where(Order.id == order_id))
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    if current_user.role is UserRole.DRIVER:
        assigned_vehicle = db.scalar(
            select(Vehicle.id).where(
                Vehicle.id == order.assigned_vehicle_id,
                Vehicle.driver_id == current_user.id,
            )
        )
        if assigned_vehicle is None:
            # Hide the existence of orders belonging to another driver.
            raise HTTPException(status_code=404, detail="Order not found")

    activities = list(
        db.scalars(
            select(OrderActivityLog)
            .where(OrderActivityLog.order_id == order.id)
            .order_by(
                OrderActivityLog.created_at.desc(),
                OrderActivityLog.id.desc(),
            )
        ).all()
    )
    return OrderActivityListResponse(
        order_id=order.id,
        order_code=order.order_code,
        activities=[
            OrderActivityRead.model_validate(activity)
            for activity in activities
        ],
    )


@router.get(
    "/{order_id}/notifications",
    response_model=list[CustomerNotificationRead],
)
def get_order_notifications(
    order_id: UUID,
    db: Session = Depends(get_db),
    _current_user: User = Depends(
        require_roles(UserRole.ADMIN, UserRole.DISPATCHER)
    ),
) -> list[CustomerNotification]:
    if db.scalar(select(Order.id).where(Order.id == order_id)) is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return list(
        db.scalars(
            select(CustomerNotification)
            .where(CustomerNotification.order_id == order_id)
            .order_by(
                CustomerNotification.sent_at.desc(),
                CustomerNotification.id.desc(),
            )
        ).all()
    )


@router.post(
    "/{order_id}/notifications/resend",
    response_model=CustomerNotificationRead,
    status_code=status.HTTP_201_CREATED,
)
def resend_order_notification(
    order_id: UUID,
    payload: NotificationResendRequest,
    db: Session = Depends(get_db),
    _current_user: User = Depends(
        require_roles(UserRole.ADMIN, UserRole.DISPATCHER)
    ),
) -> CustomerNotification:
    order = db.scalar(
        select(Order).where(Order.id == order_id).with_for_update()
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if not (order.customer_phone or "").strip():
        raise HTTPException(
            status_code=409,
            detail={
                "code": "CUSTOMER_PHONE_MISSING",
                "message": "This order has no customer phone number",
            },
        )

    template_code = notification_template_for_status(order.status)
    if template_code is None:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "NOTIFICATION_NOT_AVAILABLE",
                "message": "No notification template is available for this order status",
            },
        )

    try:
        notification = send_order_notification(
            db,
            order=order,
            template_code=template_code,
            channel=payload.channel,
        )
        if notification is None:
            raise HTTPException(status_code=409, detail="Customer phone is missing")
        db.commit()
        db.refresh(notification)
        return notification
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        logger.exception("notification_resend_failed order_id=%s", order_id)
        raise


@router.patch("/{order_id}/status", response_model=OrderRead)
def update_order_status(
    order_id: UUID,
    payload: OrderStatusUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DISPATCHER)),
) -> Order:
    assignment = db.execute(
        select(Order.assigned_vehicle_id).where(Order.id == order_id)
    ).first()
    if assignment is None:
        raise HTTPException(status_code=404, detail="Order not found")
    assigned_vehicle_id = assignment[0]
    vehicle = (
        db.scalar(
            select(Vehicle)
            .where(Vehicle.id == assigned_vehicle_id)
            .with_for_update()
        )
        if assigned_vehicle_id is not None
        else None
    )
    order = db.scalar(
        select(Order).where(Order.id == order_id).with_for_update()
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.assigned_vehicle_id != assigned_vehicle_id:
        raise HTTPException(
            status_code=409,
            detail="Order assignment changed; retry the status update",
        )

    old_status = order.status.value
    set_order_status(order, payload.status)
    failure_reason = payload.failure_reason.strip() if payload.failure_reason else None
    order.failure_reason = (
        failure_reason if payload.status is OrderStatus.FAILED else None
    )
    if payload.status is OrderStatus.PENDING:
        order.assigned_vehicle_id = None
        order.route_batch_id = None
        order.stop_sequence = None

    db.flush()
    log_order_activity(
        db,
        order_id=order.id,
        action="STATUS_CHANGED",
        actor=_current_user,
        old_status=old_status,
        new_status=payload.status.value,
        detail=order.failure_reason,
    )
    template_code = notification_template_for_status(payload.status)
    if old_status != payload.status.value and template_code is not None:
        send_order_notification(
            db,
            order=order,
            template_code=template_code,
            vehicle=vehicle,
        )
    if vehicle is not None:
        # Dispatcher overrides share the same lifecycle rule as driver updates:
        # the locked vehicle returns to IDLE only when no active stop remains.
        reconcile_vehicle_availability(db, vehicle)
    db.commit()
    db.refresh(order)
    return order
