"""COD collection, VietQR payment, and end-of-shift cash settlement."""

import csv
import io
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import (
    VIETQR_ACCOUNT_NAME,
    VIETQR_ACCOUNT_NO,
    VIETQR_BANK_CODE,
)
from app.core.security import require_roles
from app.db.models import (
    CodStatus,
    Depot,
    DriverShiftSettlement,
    Order,
    OrderStatus,
    PaymentMethod,
    SettlementStatus,
    User,
    UserRole,
    Vehicle,
)
from app.db.session import get_db
from app.schemas import (
    CodCollectionRequest,
    CodLedgerItemRead,
    CodSummaryRead,
    DriverShiftOrderRead,
    OrderRead,
    ShiftSettlementPreviewRead,
    ShiftSettlementRead,
    ShiftSettlementReviewRequest,
    ShiftSettlementSubmitRequest,
    VietQrRead,
)
from app.services.activity_logger import log_order_activity
from app.services.depot_scope import resolve_depot
from app.services.vietqr import (
    VietQrAccount,
    build_vietqr_image_url,
    build_vietqr_payload,
)


router = APIRouter(tags=["cod"])

# Money moves through this module as Decimal so cash totals never inherit
# binary floating point error; the API boundary exposes plain VND integers.
ZERO = Decimal(0)


def _vnd(value: Decimal | int | None) -> int:
    return int(value) if value is not None else 0


def _default_vietqr_account() -> VietQrAccount:
    return VietQrAccount(
        bank_code=VIETQR_BANK_CODE,
        account_no=VIETQR_ACCOUNT_NO,
        account_name=VIETQR_ACCOUNT_NAME,
    )


def _driver_vehicle(db: Session, driver: User, *, for_update: bool = False) -> Vehicle | None:
    statement = (
        select(Vehicle)
        .where(Vehicle.driver_id == driver.id)
        .order_by(Vehicle.license_plate)
        .limit(1)
    )
    if for_update:
        statement = statement.with_for_update()
    return db.scalar(statement)


def _open_shift_orders(db: Session, vehicle: Vehicle) -> list[Order]:
    """Orders on this vehicle that no settlement has claimed yet."""
    return list(
        db.scalars(
            select(Order)
            .where(
                Order.assigned_vehicle_id == vehicle.id,
                Order.shift_settlement_id.is_(None),
                Order.status.in_((OrderStatus.DELIVERED, OrderStatus.FAILED)),
            )
            .order_by(Order.stop_sequence, Order.order_code)
        ).all()
    )


def _settlement_totals(orders: list[Order]) -> dict[str, int]:
    delivered = [order for order in orders if order.status is OrderStatus.DELIVERED]
    failed = [order for order in orders if order.status is OrderStatus.FAILED]
    cash = sum(
        (order.cod_amount for order in delivered if order.payment_method is PaymentMethod.COD_CASH),
        ZERO,
    )
    vietqr = sum(
        (order.cod_amount for order in delivered if order.payment_method is PaymentMethod.VIETQR),
        ZERO,
    )
    return {
        "total_orders_count": len(orders),
        "delivered_count": len(delivered),
        "failed_count": len(failed),
        "total_cod_expected": _vnd(cash + vietqr),
        "expected_cash_amount": _vnd(cash),
        "total_vietqr_collected": _vnd(vietqr),
    }


def _settlement_payload(
    settlement: DriverShiftSettlement,
    *,
    depot: Depot | None,
    driver: User | None,
    vehicle: Vehicle | None,
    approver: User | None = None,
) -> ShiftSettlementRead:
    return ShiftSettlementRead(
        id=settlement.id,
        settlement_code=settlement.settlement_code,
        depot_id=settlement.depot_id,
        depot_name=depot.name if depot else None,
        driver_id=settlement.driver_id,
        driver_name=driver.full_name if driver else None,
        driver_email=driver.email if driver else None,
        vehicle_id=settlement.vehicle_id,
        license_plate=vehicle.license_plate if vehicle else None,
        total_orders_count=settlement.total_orders_count,
        delivered_count=settlement.delivered_count,
        failed_count=settlement.failed_count,
        total_cod_expected=_vnd(settlement.total_cod_expected),
        expected_cash_amount=_vnd(settlement.expected_cash_amount),
        total_cash_collected=_vnd(settlement.total_cash_collected),
        total_vietqr_collected=_vnd(settlement.total_vietqr_collected),
        variance_amount=_vnd(settlement.variance_amount),
        status=settlement.status,
        submitted_at=settlement.submitted_at,
        approved_at=settlement.approved_at,
        approved_by_id=settlement.approved_by_id,
        approved_by_name=approver.full_name if approver else None,
        notes=settlement.notes,
        review_note=settlement.review_note,
    )


@router.get("/cod/summary", response_model=CodSummaryRead)
def get_cod_summary(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DISPATCHER)),
    depot_id: UUID | None = None,
    nationwide: bool = False,
) -> CodSummaryRead:
    """Cash position for one hub, or nationwide when `nationwide=true`."""
    depot = None if nationwide else resolve_depot(db, depot_id)

    def scoped(statement):
        return statement if depot is None else statement.where(Order.depot_id == depot.id)

    def total_where(*conditions) -> int:
        amount = db.scalar(
            scoped(select(func.coalesce(func.sum(Order.cod_amount), 0)).where(*conditions))
        )
        return _vnd(amount)

    # Money still owed: assigned or in-flight orders that nobody has collected.
    expected = total_where(
        Order.cod_status == CodStatus.PENDING,
        Order.payment_method != PaymentMethod.PREPAID,
        Order.status.notin_((OrderStatus.FAILED,)),
    )
    cash_in_hand = total_where(
        Order.cod_status == CodStatus.COLLECTED,
        Order.payment_method == PaymentMethod.COD_CASH,
    )
    vietqr_paid = total_where(
        Order.cod_status.in_((CodStatus.COLLECTED, CodStatus.RECONCILED)),
        Order.payment_method == PaymentMethod.VIETQR,
    )
    reconciled = total_where(
        Order.cod_status == CodStatus.RECONCILED,
        Order.payment_method == PaymentMethod.COD_CASH,
    )

    settlement_query = select(func.count(DriverShiftSettlement.id)).where(
        DriverShiftSettlement.status == SettlementStatus.SUBMITTED
    )
    if depot is not None:
        settlement_query = settlement_query.where(DriverShiftSettlement.depot_id == depot.id)

    pending_orders = db.scalar(
        scoped(
            select(func.count(Order.id)).where(
                Order.cod_status == CodStatus.PENDING,
                Order.cod_amount > 0,
                Order.payment_method != PaymentMethod.PREPAID,
            )
        )
    )

    return CodSummaryRead(
        depot_id=depot.id if depot else None,
        depot_name=depot.name if depot else None,
        total_cod_expected=expected,
        total_cash_in_hand=cash_in_hand,
        total_vietqr_paid=vietqr_paid,
        total_reconciled=reconciled,
        pending_settlements_count=int(db.scalar(settlement_query) or 0),
        pending_orders_count=int(pending_orders or 0),
    )


@router.get("/driver/orders/{order_id}/vietqr", response_model=VietQrRead)
def get_order_vietqr(
    order_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.DRIVER, UserRole.ADMIN, UserRole.DISPATCHER)
    ),
) -> VietQrRead:
    """Dynamic VietQR for a COD order, prefilled with amount and order code."""
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if current_user.role is UserRole.DRIVER:
        vehicle = _driver_vehicle(db, current_user)
        if vehicle is None or order.assigned_vehicle_id != vehicle.id:
            raise HTTPException(
                status_code=404,
                detail="Order is not assigned to this driver",
            )
    if _vnd(order.cod_amount) <= 0:
        raise HTTPException(
            status_code=422,
            detail="Order has no COD amount to collect",
        )

    account = _default_vietqr_account()
    amount = _vnd(order.cod_amount)
    add_info = f"Thanh toan COD {order.order_code}"
    return VietQrRead(
        order_code=order.order_code,
        amount=amount,
        bank_code=account.bank_code,
        bank_bin=account.bank_bin,
        account_no=account.account_no,
        account_name=account.account_name,
        add_info=add_info,
        payload=build_vietqr_payload(account=account, amount=amount, add_info=add_info),
        image_url=build_vietqr_image_url(account=account, amount=amount, add_info=add_info),
    )


@router.post("/driver/orders/{order_id}/collect-cod", response_model=OrderRead)
def collect_order_cod(
    order_id: UUID,
    payload: CodCollectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DRIVER, UserRole.ADMIN)),
) -> Order:
    """Record how the customer actually paid a COD order at the door."""
    statement = select(Order).where(Order.id == order_id).with_for_update()
    order = db.scalar(statement)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    if current_user.role is UserRole.DRIVER:
        vehicle = _driver_vehicle(db, current_user)
        if vehicle is None or order.assigned_vehicle_id != vehicle.id:
            raise HTTPException(
                status_code=404,
                detail="Order is not assigned to this driver",
            )

    if order.payment_method is PaymentMethod.PREPAID:
        raise HTTPException(
            status_code=422,
            detail="A prepaid order has nothing to collect",
        )
    if _vnd(order.cod_amount) <= 0:
        raise HTTPException(
            status_code=422,
            detail="Order has no COD amount to collect",
        )
    # Once the cash reaches the depot vault the record is an accounting fact.
    if order.cod_status is CodStatus.RECONCILED:
        raise HTTPException(
            status_code=409,
            detail="COD for this order is already reconciled to the depot vault",
        )
    if order.shift_settlement_id is not None:
        raise HTTPException(
            status_code=409,
            detail="COD for this order is already part of a submitted settlement",
        )

    order.payment_method = PaymentMethod(payload.payment_method)
    order.cod_status = CodStatus.COLLECTED
    order.cod_collected_at = datetime.now(timezone.utc)
    order.cod_receipt_note = payload.cod_receipt_note
    db.flush()
    log_order_activity(
        db,
        order_id=order.id,
        action="COD_COLLECTED",
        actor=current_user,
        detail=f"{order.payment_method.value}: {_vnd(order.cod_amount)} VND",
    )
    db.commit()
    db.refresh(order)
    return order


@router.get("/driver/shift-settlement/preview", response_model=ShiftSettlementPreviewRead)
def preview_shift_settlement(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DRIVER)),
) -> ShiftSettlementPreviewRead:
    """What the driver owes the depot vault for the shift they just finished."""
    vehicle = _driver_vehicle(db, current_user)
    if vehicle is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No vehicle is assigned to this driver",
        )

    orders = _open_shift_orders(db, vehicle)
    totals = _settlement_totals(orders)
    depot = resolve_depot(db, vehicle.depot_id)
    return ShiftSettlementPreviewRead(
        depot_id=depot.id if depot else None,
        depot_name=depot.name if depot else None,
        vehicle_id=vehicle.id,
        license_plate=vehicle.license_plate,
        can_submit=bool(orders) and depot is not None,
        orders=[DriverShiftOrderRead.model_validate(order) for order in orders],
        **totals,
    )


def _next_settlement_code(db: Session, vehicle: Vehicle, moment: datetime) -> str:
    plate = "".join(char for char in vehicle.license_plate if char.isalnum()).upper()
    prefix = f"STL-{moment.strftime('%Y%m%d')}-{plate}"
    taken = set(
        db.scalars(
            select(DriverShiftSettlement.settlement_code).where(
                DriverShiftSettlement.settlement_code.like(f"{prefix}%")
            )
        ).all()
    )
    if prefix not in taken:
        return prefix
    # A driver can run more than one shift a day; suffix the later handovers.
    sequence = 2
    while f"{prefix}-{sequence}" in taken:
        sequence += 1
    return f"{prefix}-{sequence}"


@router.post(
    "/driver/shift-settlement/submit",
    response_model=ShiftSettlementRead,
    status_code=status.HTTP_201_CREATED,
)
def submit_shift_settlement(
    payload: ShiftSettlementSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DRIVER)),
) -> ShiftSettlementRead:
    """File the end-of-shift cash handover for a depot cashier to review."""
    # Lock the vehicle first so two submissions cannot claim the same orders.
    vehicle = _driver_vehicle(db, current_user, for_update=True)
    if vehicle is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No vehicle is assigned to this driver",
        )

    orders = _open_shift_orders(db, vehicle)
    if not orders:
        raise HTTPException(
            status_code=422,
            detail="There are no completed stops to settle for this shift",
        )

    depot = resolve_depot(db, vehicle.depot_id)
    if depot is None:
        raise HTTPException(
            status_code=422,
            detail="No depot is configured to receive this settlement",
        )

    totals = _settlement_totals(orders)
    now = datetime.now(timezone.utc)
    settlement = DriverShiftSettlement(
        settlement_code=_next_settlement_code(db, vehicle, now),
        depot_id=depot.id,
        driver_id=current_user.id,
        vehicle_id=vehicle.id,
        total_orders_count=totals["total_orders_count"],
        delivered_count=totals["delivered_count"],
        failed_count=totals["failed_count"],
        total_cod_expected=Decimal(totals["total_cod_expected"]),
        expected_cash_amount=Decimal(totals["expected_cash_amount"]),
        total_cash_collected=Decimal(payload.total_cash_collected),
        total_vietqr_collected=Decimal(totals["total_vietqr_collected"]),
        # Negative means the driver is short against what the system expected.
        variance_amount=Decimal(payload.total_cash_collected - totals["expected_cash_amount"]),
        status=SettlementStatus.SUBMITTED,
        submitted_at=now,
        notes=payload.notes,
    )
    db.add(settlement)
    db.flush()

    for order in orders:
        order.shift_settlement_id = settlement.id
    db.commit()
    db.refresh(settlement)
    return _settlement_payload(
        settlement,
        depot=depot,
        driver=current_user,
        vehicle=vehicle,
    )


def _settlement_rows(
    db: Session,
    *,
    depot: Depot | None,
    settlement_status: SettlementStatus | None = None,
) -> list[tuple[DriverShiftSettlement, Depot | None, User | None, Vehicle | None]]:
    statement = (
        select(DriverShiftSettlement, Depot, User, Vehicle)
        .join(Depot, Depot.id == DriverShiftSettlement.depot_id, isouter=True)
        .join(User, User.id == DriverShiftSettlement.driver_id, isouter=True)
        .join(Vehicle, Vehicle.id == DriverShiftSettlement.vehicle_id, isouter=True)
        .order_by(DriverShiftSettlement.submitted_at.desc())
    )
    if depot is not None:
        statement = statement.where(DriverShiftSettlement.depot_id == depot.id)
    if settlement_status is not None:
        statement = statement.where(DriverShiftSettlement.status == settlement_status)
    return list(db.execute(statement).all())


@router.get("/admin/cod/settlements", response_model=list[ShiftSettlementRead])
def list_shift_settlements(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DISPATCHER)),
    depot_id: UUID | None = None,
    nationwide: bool = False,
    settlement_status: SettlementStatus | None = None,
) -> list[ShiftSettlementRead]:
    depot = None if nationwide else resolve_depot(db, depot_id)
    return [
        _settlement_payload(settlement, depot=row_depot, driver=driver, vehicle=vehicle)
        for settlement, row_depot, driver, vehicle in _settlement_rows(
            db, depot=depot, settlement_status=settlement_status
        )
    ]


def _review_settlement(
    db: Session,
    settlement_id: UUID,
    reviewer: User,
    *,
    approved: bool,
    review_note: str | None,
) -> ShiftSettlementRead:
    settlement = db.scalar(
        select(DriverShiftSettlement)
        .where(DriverShiftSettlement.id == settlement_id)
        .with_for_update()
    )
    if settlement is None:
        raise HTTPException(status_code=404, detail="Settlement not found")
    if settlement.status is not SettlementStatus.SUBMITTED:
        raise HTTPException(
            status_code=409,
            detail="This settlement has already been reviewed",
        )

    now = datetime.now(timezone.utc)
    settlement.status = (
        SettlementStatus.APPROVED if approved else SettlementStatus.REJECTED
    )
    settlement.approved_at = now
    settlement.approved_by_id = reviewer.id
    settlement.review_note = review_note

    orders = list(
        db.scalars(
            select(Order)
            .where(Order.shift_settlement_id == settlement.id)
            .with_for_update()
        ).all()
    )
    for order in orders:
        if approved:
            # Cash is physically in the depot vault now.
            if order.status is OrderStatus.DELIVERED and _vnd(order.cod_amount) > 0:
                order.cod_status = CodStatus.RECONCILED
                order.cod_reconciled_at = now
            log_order_activity(
                db,
                order_id=order.id,
                action="COD_RECONCILED",
                actor=reviewer,
                detail=settlement.settlement_code,
            )
        else:
            # Release the orders so the driver can refile a corrected handover.
            order.shift_settlement_id = None
            log_order_activity(
                db,
                order_id=order.id,
                action="COD_SETTLEMENT_REJECTED",
                actor=reviewer,
                detail=settlement.settlement_code,
            )

    # Settlement status and every order's COD status commit together, so a
    # partially reconciled shift can never be observed.
    db.commit()
    db.refresh(settlement)
    return _settlement_payload(
        settlement,
        depot=db.get(Depot, settlement.depot_id),
        driver=db.get(User, settlement.driver_id),
        vehicle=db.get(Vehicle, settlement.vehicle_id),
        approver=reviewer,
    )


@router.post(
    "/admin/cod/settlements/{settlement_id}/approve",
    response_model=ShiftSettlementRead,
)
def approve_shift_settlement(
    settlement_id: UUID,
    payload: ShiftSettlementReviewRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DISPATCHER)),
) -> ShiftSettlementRead:
    """Confirm the cash counted at the depot counter matches the handover."""
    return _review_settlement(
        db,
        settlement_id,
        current_user,
        approved=True,
        review_note=payload.review_note if payload else None,
    )


@router.post(
    "/admin/cod/settlements/{settlement_id}/reject",
    response_model=ShiftSettlementRead,
)
def reject_shift_settlement(
    settlement_id: UUID,
    payload: ShiftSettlementReviewRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DISPATCHER)),
) -> ShiftSettlementRead:
    """Send a mismatched handover back so the driver can refile it."""
    return _review_settlement(
        db,
        settlement_id,
        current_user,
        approved=False,
        review_note=payload.review_note if payload else None,
    )


def _ledger_rows(
    db: Session,
    *,
    depot: Depot | None,
    cod_status: CodStatus | None,
    search: str | None,
):
    statement = (
        select(Order, Depot, Vehicle, User, DriverShiftSettlement)
        .join(Depot, Depot.id == Order.depot_id, isouter=True)
        .join(Vehicle, Vehicle.id == Order.assigned_vehicle_id, isouter=True)
        .join(User, User.id == Vehicle.driver_id, isouter=True)
        .join(
            DriverShiftSettlement,
            DriverShiftSettlement.id == Order.shift_settlement_id,
            isouter=True,
        )
        .where(Order.payment_method != PaymentMethod.PREPAID, Order.cod_amount > 0)
        .order_by(Order.order_code)
    )
    if depot is not None:
        statement = statement.where(Order.depot_id == depot.id)
    if cod_status is not None:
        statement = statement.where(Order.cod_status == cod_status)
    if search:
        needle = f"%{search.strip().lower()}%"
        statement = statement.where(
            func.lower(Order.order_code).like(needle)
            | func.lower(Order.customer_name).like(needle)
        )
    return list(db.execute(statement).all())


def _ledger_item(order, depot, vehicle, driver, settlement) -> CodLedgerItemRead:
    return CodLedgerItemRead(
        order_id=order.id,
        order_code=order.order_code,
        customer_name=order.customer_name,
        address=order.address,
        depot_id=depot.id if depot else None,
        depot_name=depot.name if depot else None,
        license_plate=vehicle.license_plate if vehicle else None,
        driver_name=driver.full_name if driver else None,
        status=order.status,
        cod_amount=_vnd(order.cod_amount),
        payment_method=order.payment_method,
        cod_status=order.cod_status,
        cod_collected_at=order.cod_collected_at,
        cod_reconciled_at=order.cod_reconciled_at,
        settlement_code=settlement.settlement_code if settlement else None,
    )


@router.get("/admin/cod/ledger", response_model=list[CodLedgerItemRead])
def list_cod_ledger(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DISPATCHER)),
    depot_id: UUID | None = None,
    nationwide: bool = False,
    cod_status: CodStatus | None = None,
    search: str | None = None,
) -> list[CodLedgerItemRead]:
    depot = None if nationwide else resolve_depot(db, depot_id)
    return [
        _ledger_item(*row)
        for row in _ledger_rows(db, depot=depot, cod_status=cod_status, search=search)
    ]


def _csv_cell(value: object) -> str:
    """Neutralise spreadsheet formula injection in exported text."""
    text = "" if value is None else str(value)
    return f"'{text}" if text[:1] in {"=", "+", "-", "@"} else text


def build_cod_export_csv(items: list[CodLedgerItemRead]) -> bytes:
    """Excel-compatible COD ledger, UTF-8 with BOM so Vietnamese survives."""
    stream = io.StringIO()
    writer = csv.writer(stream, lineterminator="\r\n")
    writer.writerow(
        (
            "Mã đơn hàng",
            "Khách hàng",
            "Địa chỉ",
            "Hub",
            "Biển số xe",
            "Tài xế",
            "Trạng thái đơn",
            "Số tiền COD (VNĐ)",
            "Phương thức",
            "Trạng thái COD",
            "Thời điểm thu",
            "Thời điểm nộp quỹ",
            "Mã phiếu bàn giao",
        )
    )
    for item in items:
        writer.writerow(
            (
                _csv_cell(item.order_code),
                _csv_cell(item.customer_name),
                _csv_cell(item.address),
                _csv_cell(item.depot_name),
                _csv_cell(item.license_plate),
                _csv_cell(item.driver_name),
                _csv_cell(item.status.value),
                item.cod_amount,
                _csv_cell(item.payment_method.value),
                _csv_cell(item.cod_status.value),
                _csv_cell(
                    item.cod_collected_at.isoformat() if item.cod_collected_at else ""
                ),
                _csv_cell(
                    item.cod_reconciled_at.isoformat() if item.cod_reconciled_at else ""
                ),
                _csv_cell(item.settlement_code),
            )
        )
    return ("﻿" + stream.getvalue()).encode("utf-8")


@router.get("/admin/cod/export", response_class=Response)
def export_cod_ledger(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DISPATCHER)),
    depot_id: UUID | None = None,
    nationwide: bool = False,
    cod_status: CodStatus | None = None,
    search: str | None = None,
) -> Response:
    depot = None if nationwide else resolve_depot(db, depot_id)
    items = [
        _ledger_item(*row)
        for row in _ledger_rows(db, depot=depot, cod_status=cod_status, search=search)
    ]
    filename = f"logiroute-cod-ledger-{datetime.now(timezone.utc).date().isoformat()}.csv"
    return Response(
        content=build_cod_export_csv(items),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Content-Type-Options": "nosniff",
        },
    )
