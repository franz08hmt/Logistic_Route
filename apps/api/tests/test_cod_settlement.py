from datetime import datetime, timezone
from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.v1.cod import (
    approve_shift_settlement,
    build_cod_export_csv,
    collect_order_cod,
    export_cod_ledger,
    get_cod_summary,
    get_order_vietqr,
    list_cod_ledger,
    list_shift_settlements,
    preview_shift_settlement,
    reject_shift_settlement,
    submit_shift_settlement,
)
from app.db.base import Base
from app.db.models import (
    CodStatus,
    Depot,
    Order,
    OrderStatus,
    PaymentMethod,
    SettlementStatus,
    User,
    UserRole,
    UserStatus,
    Vehicle,
    VehicleStatus,
)
from app.main import app
from app.schemas import (
    CodCollectionRequest,
    ShiftSettlementReviewRequest,
    ShiftSettlementSubmitRequest,
)
from app.services.vietqr import (
    VietQrAccount,
    build_vietqr_payload,
    crc16_ccitt,
    normalize_add_info,
    resolve_bank_bin,
)


@pytest.fixture
def db() -> Session:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def _build_shift(db: Session) -> dict[str, object]:
    """One depot, one driver with a vehicle, and a finished delivery shift."""
    depot = Depot(
        code="HUB-SGN",
        name="Hub Tân Bình",
        city="TP. Hồ Chí Minh",
        address="15 Trường Chinh, Phường 13, Quận Tân Bình, TP.HCM",
        latitude=10.8009,
        longitude=106.6432,
        is_default=True,
    )
    driver = User(
        email="driver1@logiroute.vn",
        hashed_password="unused",
        full_name="Nguyễn Văn Tài",
        role=UserRole.DRIVER,
        status=UserStatus.ACTIVE,
    )
    cashier = User(
        email="admin@logiroute.vn",
        hashed_password="unused",
        full_name="Trần Thu Quỹ",
        role=UserRole.ADMIN,
        status=UserStatus.ACTIVE,
    )
    db.add_all((depot, driver, cashier))
    db.flush()

    vehicle = Vehicle(
        license_plate="51F-888.88",
        capacity_kg=1200,
        status=VehicleStatus.ON_ROUTE,
        driver_id=driver.id,
        depot_id=depot.id,
    )
    db.add(vehicle)
    db.flush()

    specs = (
        # (code, order status, COD amount, payment method, stop sequence)
        ("LR-COD-001", OrderStatus.DELIVERED, 350_000, PaymentMethod.COD_CASH, 1),
        ("LR-COD-002", OrderStatus.DELIVERED, 720_000, PaymentMethod.VIETQR, 2),
        ("LR-COD-003", OrderStatus.DELIVERED, 0, PaymentMethod.PREPAID, 3),
        ("LR-COD-004", OrderStatus.FAILED, 1_250_000, PaymentMethod.COD_CASH, 4),
        ("LR-COD-005", OrderStatus.DELIVERING, 480_000, PaymentMethod.COD_CASH, 5),
    )
    orders: dict[str, Order] = {}
    for code, order_status, cod, method, stop in specs:
        collected = order_status is OrderStatus.DELIVERED and cod > 0
        order = Order(
            depot_id=depot.id,
            order_code=code,
            tracking_token=f"token-{code}-0123456789abcdef0123456789abcdef",
            customer_name="Lê Thị Khách",
            address="9 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM",
            latitude=10.7743,
            longitude=106.7038,
            weight_kg=12.0,
            status=order_status,
            assigned_vehicle_id=vehicle.id,
            stop_sequence=stop,
            cod_amount=Decimal(cod),
            payment_method=method,
            cod_status=CodStatus.COLLECTED if collected else CodStatus.PENDING,
            cod_collected_at=datetime.now(timezone.utc) if collected else None,
        )
        db.add(order)
        orders[code] = order
    db.flush()
    return {
        "depot": depot,
        "driver": driver,
        "cashier": cashier,
        "vehicle": vehicle,
        "orders": orders,
    }


# --- VietQR payload ---------------------------------------------------------


def test_vietqr_payload_is_valid_emvco_with_matching_crc() -> None:
    account = VietQrAccount("VCB", "0071001234567", "CONG TY LOGIROUTE VIET NAM")
    payload = build_vietqr_payload(
        account=account,
        amount=Decimal(450_000),
        add_info="Thanh toan COD LR-COD-001",
    )

    assert payload.startswith("000201")
    # Tag 01 = "12" marks a dynamic, single-use code because it carries an amount.
    assert "010212" in payload
    assert "5303704" in payload
    assert "5406450000" in payload
    assert "5802VN" in payload
    assert payload[-8:-4] == "6304"
    assert crc16_ccitt(payload[:-4]) == payload[-4:]


def test_vietqr_rejects_zero_amount_and_unknown_bank() -> None:
    account = VietQrAccount("VCB", "0071001234567", "LOGIROUTE")
    with pytest.raises(ValueError):
        build_vietqr_payload(account=account, amount=0, add_info="x")
    with pytest.raises(ValueError):
        resolve_bank_bin("NOT-A-BANK")


def test_vietqr_add_info_is_folded_to_bank_safe_ascii() -> None:
    assert normalize_add_info("Thanh toán đơn ĐH-001") == "Thanh toan don DH-001"


def test_vietqr_accepts_a_raw_six_digit_bin() -> None:
    assert resolve_bank_bin("970436") == "970436"
    assert resolve_bank_bin("vcb") == "970436"


# --- Driver COD collection --------------------------------------------------


def test_driver_collects_cod_and_marks_the_order_collected(db: Session) -> None:
    shift = _build_shift(db)
    order = shift["orders"]["LR-COD-005"]

    result = collect_order_cod(
        order.id,
        CodCollectionRequest(
            payment_method=PaymentMethod.VIETQR,
            cod_receipt_note="Khách quét mã VietQR tại cửa",
        ),
        db=db,
        current_user=shift["driver"],
    )

    assert result.cod_status is CodStatus.COLLECTED
    assert result.payment_method is PaymentMethod.VIETQR
    assert result.cod_collected_at is not None
    assert result.cod_receipt_note == "Khách quét mã VietQR tại cửa"


def test_collecting_cod_on_a_prepaid_order_is_rejected(db: Session) -> None:
    shift = _build_shift(db)

    with pytest.raises(HTTPException) as error:
        collect_order_cod(
            shift["orders"]["LR-COD-003"].id,
            CodCollectionRequest(payment_method=PaymentMethod.COD_CASH),
            db=db,
            current_user=shift["driver"],
        )
    assert error.value.status_code == 422


def test_a_driver_cannot_collect_cod_for_another_drivers_order(db: Session) -> None:
    shift = _build_shift(db)
    other = User(
        email="driver2@logiroute.vn",
        hashed_password="unused",
        full_name="Phạm Văn Khác",
        role=UserRole.DRIVER,
        status=UserStatus.ACTIVE,
    )
    db.add(other)
    db.flush()

    with pytest.raises(HTTPException) as error:
        collect_order_cod(
            shift["orders"]["LR-COD-005"].id,
            CodCollectionRequest(payment_method=PaymentMethod.COD_CASH),
            db=db,
            current_user=other,
        )
    assert error.value.status_code == 404


def test_vietqr_endpoint_returns_the_order_amount_and_code(db: Session) -> None:
    shift = _build_shift(db)

    result = get_order_vietqr(
        shift["orders"]["LR-COD-005"].id,
        db=db,
        current_user=shift["driver"],
    )

    assert result.amount == 480_000
    assert result.bank_bin == "970436"
    assert "LR-COD-005" in result.add_info
    assert crc16_ccitt(result.payload[:-4]) == result.payload[-4:]


def test_vietqr_endpoint_rejects_an_order_without_cod(db: Session) -> None:
    shift = _build_shift(db)

    with pytest.raises(HTTPException) as error:
        get_order_vietqr(
            shift["orders"]["LR-COD-003"].id,
            db=db,
            current_user=shift["driver"],
        )
    assert error.value.status_code == 422


# --- Shift settlement -------------------------------------------------------


def test_settlement_preview_totals_only_completed_unsettled_stops(db: Session) -> None:
    shift = _build_shift(db)

    preview = preview_shift_settlement(db=db, current_user=shift["driver"])

    # LR-COD-005 is still DELIVERING, so it stays out of this shift.
    assert preview.total_orders_count == 4
    assert preview.delivered_count == 3
    assert preview.failed_count == 1
    assert preview.expected_cash_amount == 350_000
    assert preview.total_vietqr_collected == 720_000
    assert preview.total_cod_expected == 1_070_000
    assert preview.license_plate == "51F-888.88"
    assert preview.can_submit is True


def test_submitting_a_settlement_binds_its_orders_and_records_variance(
    db: Session,
) -> None:
    shift = _build_shift(db)

    settlement = submit_shift_settlement(
        ShiftSettlementSubmitRequest(
            total_cash_collected=300_000,
            notes="Thiếu 50.000đ, khách hẹn trả sau",
        ),
        db=db,
        current_user=shift["driver"],
    )

    assert settlement.settlement_code.startswith("STL-")
    assert "51F88888" in settlement.settlement_code
    assert settlement.status is SettlementStatus.SUBMITTED
    assert settlement.expected_cash_amount == 350_000
    assert settlement.total_cash_collected == 300_000
    # Negative variance is the shortfall the cashier must see before approving.
    assert settlement.variance_amount == -50_000
    assert settlement.driver_name == "Nguyễn Văn Tài"

    bound = {
        order.order_code
        for order in shift["orders"].values()
        if order.shift_settlement_id == settlement.id
    }
    assert bound == {"LR-COD-001", "LR-COD-002", "LR-COD-003", "LR-COD-004"}


def test_a_second_submission_cannot_reclaim_already_settled_orders(db: Session) -> None:
    shift = _build_shift(db)
    submit_shift_settlement(
        ShiftSettlementSubmitRequest(total_cash_collected=350_000),
        db=db,
        current_user=shift["driver"],
    )

    with pytest.raises(HTTPException) as error:
        submit_shift_settlement(
            ShiftSettlementSubmitRequest(total_cash_collected=350_000),
            db=db,
            current_user=shift["driver"],
        )
    assert error.value.status_code == 422


def test_settlement_codes_stay_unique_within_one_day(db: Session) -> None:
    shift = _build_shift(db)
    first = submit_shift_settlement(
        ShiftSettlementSubmitRequest(total_cash_collected=350_000),
        db=db,
        current_user=shift["driver"],
    )

    second_shift_order = Order(
        depot_id=shift["depot"].id,
        order_code="LR-COD-006",
        tracking_token="token-LR-COD-006-0123456789abcdef0123456789ab",
        customer_name="Khách ca hai",
        address="1 Lê Duẩn, Phường Bến Nghé, Quận 1, TP.HCM",
        latitude=10.7810,
        longitude=106.6996,
        weight_kg=5.0,
        status=OrderStatus.DELIVERED,
        assigned_vehicle_id=shift["vehicle"].id,
        stop_sequence=1,
        cod_amount=Decimal(200_000),
        payment_method=PaymentMethod.COD_CASH,
        cod_status=CodStatus.COLLECTED,
    )
    db.add(second_shift_order)
    db.flush()

    second = submit_shift_settlement(
        ShiftSettlementSubmitRequest(total_cash_collected=200_000),
        db=db,
        current_user=shift["driver"],
    )

    assert second.settlement_code != first.settlement_code
    assert second.settlement_code.endswith("-2")


def test_a_driver_without_completed_stops_cannot_submit(db: Session) -> None:
    shift = _build_shift(db)
    for order in shift["orders"].values():
        order.status = OrderStatus.DELIVERING
    db.flush()

    with pytest.raises(HTTPException) as error:
        submit_shift_settlement(
            ShiftSettlementSubmitRequest(total_cash_collected=0),
            db=db,
            current_user=shift["driver"],
        )
    assert error.value.status_code == 422


# --- Cashier review ---------------------------------------------------------


def test_approval_reconciles_every_order_in_the_shift(db: Session) -> None:
    shift = _build_shift(db)
    settlement = submit_shift_settlement(
        ShiftSettlementSubmitRequest(total_cash_collected=350_000),
        db=db,
        current_user=shift["driver"],
    )

    approved = approve_shift_settlement(
        settlement.id,
        ShiftSettlementReviewRequest(review_note="Đã kiểm đếm đủ tiền mặt"),
        db=db,
        current_user=shift["cashier"],
    )

    assert approved.status is SettlementStatus.APPROVED
    assert approved.approved_at is not None
    assert approved.approved_by_id == shift["cashier"].id

    delivered_cod = shift["orders"]["LR-COD-001"]
    db.refresh(delivered_cod)
    assert delivered_cod.cod_status is CodStatus.RECONCILED
    assert delivered_cod.cod_reconciled_at is not None

    # A failed stop collected no money, so it must not be marked reconciled.
    failed = shift["orders"]["LR-COD-004"]
    db.refresh(failed)
    assert failed.cod_status is CodStatus.PENDING


def test_a_settlement_cannot_be_reviewed_twice(db: Session) -> None:
    shift = _build_shift(db)
    settlement = submit_shift_settlement(
        ShiftSettlementSubmitRequest(total_cash_collected=350_000),
        db=db,
        current_user=shift["driver"],
    )
    approve_shift_settlement(settlement.id, None, db=db, current_user=shift["cashier"])

    with pytest.raises(HTTPException) as error:
        approve_shift_settlement(
            settlement.id, None, db=db, current_user=shift["cashier"]
        )
    assert error.value.status_code == 409


def test_rejection_releases_orders_so_the_driver_can_refile(db: Session) -> None:
    shift = _build_shift(db)
    settlement = submit_shift_settlement(
        ShiftSettlementSubmitRequest(total_cash_collected=100_000),
        db=db,
        current_user=shift["driver"],
    )

    rejected = reject_shift_settlement(
        settlement.id,
        ShiftSettlementReviewRequest(review_note="Thiếu 250.000đ, đề nghị nộp lại"),
        db=db,
        current_user=shift["cashier"],
    )

    assert rejected.status is SettlementStatus.REJECTED
    assert rejected.review_note == "Thiếu 250.000đ, đề nghị nộp lại"

    order = shift["orders"]["LR-COD-001"]
    db.refresh(order)
    assert order.shift_settlement_id is None
    assert order.cod_status is CodStatus.COLLECTED

    refiled = submit_shift_settlement(
        ShiftSettlementSubmitRequest(total_cash_collected=350_000),
        db=db,
        current_user=shift["driver"],
    )
    assert refiled.variance_amount == 0


def test_collecting_cod_is_blocked_once_the_order_is_settled(db: Session) -> None:
    shift = _build_shift(db)
    settlement = submit_shift_settlement(
        ShiftSettlementSubmitRequest(total_cash_collected=350_000),
        db=db,
        current_user=shift["driver"],
    )
    approve_shift_settlement(settlement.id, None, db=db, current_user=shift["cashier"])

    with pytest.raises(HTTPException) as error:
        collect_order_cod(
            shift["orders"]["LR-COD-001"].id,
            CodCollectionRequest(payment_method=PaymentMethod.COD_CASH),
            db=db,
            current_user=shift["driver"],
        )
    assert error.value.status_code == 409


# --- Summary, ledger, and export -------------------------------------------


def test_cod_summary_splits_cash_in_hand_from_vietqr_and_vault(db: Session) -> None:
    shift = _build_shift(db)

    before = get_cod_summary(db=db, _current_user=shift["cashier"])
    assert before.total_cash_in_hand == 350_000
    assert before.total_vietqr_paid == 720_000
    assert before.total_reconciled == 0
    assert before.pending_settlements_count == 0
    # The failed stop is excluded; only LR-COD-005 is still owed.
    assert before.total_cod_expected == 480_000

    settlement = submit_shift_settlement(
        ShiftSettlementSubmitRequest(total_cash_collected=350_000),
        db=db,
        current_user=shift["driver"],
    )
    pending = get_cod_summary(db=db, _current_user=shift["cashier"])
    assert pending.pending_settlements_count == 1

    approve_shift_settlement(settlement.id, None, db=db, current_user=shift["cashier"])
    after = get_cod_summary(db=db, _current_user=shift["cashier"])
    assert after.total_cash_in_hand == 0
    assert after.total_reconciled == 350_000
    assert after.pending_settlements_count == 0


def test_settlement_list_can_be_filtered_by_status(db: Session) -> None:
    shift = _build_shift(db)
    submit_shift_settlement(
        ShiftSettlementSubmitRequest(total_cash_collected=350_000),
        db=db,
        current_user=shift["driver"],
    )

    submitted = list_shift_settlements(
        db=db,
        _current_user=shift["cashier"],
        settlement_status=SettlementStatus.SUBMITTED,
    )
    approved = list_shift_settlements(
        db=db,
        _current_user=shift["cashier"],
        settlement_status=SettlementStatus.APPROVED,
    )

    assert len(submitted) == 1
    assert submitted[0].license_plate == "51F-888.88"
    assert submitted[0].depot_name == "Hub Tân Bình"
    assert approved == []


def test_ledger_excludes_prepaid_orders_and_supports_search(db: Session) -> None:
    shift = _build_shift(db)

    everything = list_cod_ledger(db=db, _current_user=shift["cashier"])
    codes = {item.order_code for item in everything}
    # A prepaid order has nothing to reconcile, so it never enters the ledger.
    assert codes == {"LR-COD-001", "LR-COD-002", "LR-COD-004", "LR-COD-005"}

    searched = list_cod_ledger(
        db=db, _current_user=shift["cashier"], search="lr-cod-002"
    )
    assert [item.order_code for item in searched] == ["LR-COD-002"]

    collected = list_cod_ledger(
        db=db, _current_user=shift["cashier"], cod_status=CodStatus.COLLECTED
    )
    assert {item.order_code for item in collected} == {"LR-COD-001", "LR-COD-002"}


def test_cod_export_is_utf8_with_bom_and_neutralises_formulas(db: Session) -> None:
    shift = _build_shift(db)
    shift["orders"]["LR-COD-001"].customer_name = "=HYPERLINK(1)"
    db.flush()

    response = export_cod_ledger(db=db, _current_user=shift["cashier"])
    body = response.body

    assert response.media_type == "text/csv"
    assert body.startswith(b"\xef\xbb\xbf")
    decoded = body.decode("utf-8-sig")
    assert "Mã đơn hàng" in decoded
    assert "Số tiền COD (VNĐ)" in decoded
    assert "'=HYPERLINK(1)" in decoded
    assert "LR-COD-003" not in decoded


def test_export_csv_builder_emits_one_row_per_ledger_item(db: Session) -> None:
    shift = _build_shift(db)
    items = list_cod_ledger(db=db, _current_user=shift["cashier"])

    lines = build_cod_export_csv(items).decode("utf-8-sig").strip().split("\r\n")

    assert len(lines) == len(items) + 1


# --- Contract ---------------------------------------------------------------


def test_cod_api_contract_is_exposed_in_openapi() -> None:
    paths = app.openapi()["paths"]

    assert "get" in paths["/api/v1/cod/summary"]
    assert "post" in paths["/api/v1/driver/orders/{order_id}/collect-cod"]
    assert "get" in paths["/api/v1/driver/orders/{order_id}/vietqr"]
    assert "get" in paths["/api/v1/driver/shift-settlement/preview"]
    assert "post" in paths["/api/v1/driver/shift-settlement/submit"]
    assert "get" in paths["/api/v1/admin/cod/settlements"]
    assert "post" in paths["/api/v1/admin/cod/settlements/{settlement_id}/approve"]
    assert "post" in paths["/api/v1/admin/cod/settlements/{settlement_id}/reject"]
    assert "get" in paths["/api/v1/admin/cod/ledger"]
    assert "get" in paths["/api/v1/admin/cod/export"]
