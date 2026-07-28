import pytest
from pydantic import ValidationError

from app.schemas import OrderCreate, OrderStatusUpdate, VehicleCreate


def test_order_schema_accepts_valid_order() -> None:
    order = OrderCreate(
        order_code="ORD-001",
        customer_name="Nguyen Van A",
        address="Quan 1, Ho Chi Minh City",
        latitude=10.7769,
        longitude=106.7009,
        weight_kg=2.5,
    )

    assert order.status.value == "PENDING"


def test_vehicle_schema_rejects_invalid_capacity() -> None:
    with pytest.raises(ValidationError):
        VehicleCreate(license_plate="51D-12345", capacity_kg=0)


def test_order_schema_rejects_invalid_coordinates() -> None:
    with pytest.raises(ValidationError):
        OrderCreate(
            order_code="ORD-002",
            customer_name="Nguyen Van B",
            address="Thu Duc, Ho Chi Minh City",
            latitude=100,
            longitude=106.7,
            weight_kg=1,
        )


def test_order_status_update_accepts_failed_reason_and_all_statuses() -> None:
    update = OrderStatusUpdate(
        status="FAILED",
        failure_reason="Khach khong nghe may",
    )

    assert update.status.value == "FAILED"
    assert update.failure_reason == "Khach khong nghe may"


def test_order_status_update_rejects_unknown_status() -> None:
    with pytest.raises(ValidationError):
        OrderStatusUpdate(status="CANCELLED")
