from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.config import PUBLIC_TRACKING_BASE_URL
from app.db.models import (
    CustomerNotification,
    NotificationChannel,
    NotificationStatus,
    Order,
    OrderStatus,
    User,
    Vehicle,
)


ORDER_ASSIGNED = "ORDER_ASSIGNED"
ORDER_OUT_FOR_DELIVERY = "ORDER_OUT_FOR_DELIVERY"
ORDER_DELIVERED = "ORDER_DELIVERED"
ORDER_FAILED = "ORDER_FAILED"


@dataclass(frozen=True)
class NotificationContent:
    title: str
    message: str


def notification_template_for_status(status: OrderStatus) -> str | None:
    return {
        OrderStatus.ASSIGNED: ORDER_ASSIGNED,
        OrderStatus.DELIVERING: ORDER_OUT_FOR_DELIVERY,
        OrderStatus.DELIVERED: ORDER_DELIVERED,
        OrderStatus.FAILED: ORDER_FAILED,
    }.get(status)


def _resolve_delivery_people(
    db: Session,
    *,
    order: Order,
    vehicle: Vehicle | None,
    driver: User | None,
) -> tuple[Vehicle | None, User | None]:
    resolved_vehicle = vehicle
    if resolved_vehicle is None and order.assigned_vehicle_id is not None:
        resolved_vehicle = db.get(Vehicle, order.assigned_vehicle_id)

    resolved_driver = driver
    if (
        resolved_driver is None
        and resolved_vehicle is not None
        and resolved_vehicle.driver_id is not None
    ):
        resolved_driver = db.get(User, resolved_vehicle.driver_id)
    return resolved_vehicle, resolved_driver


def _build_content(
    *,
    template_code: str,
    order: Order,
    vehicle: Vehicle | None,
    driver: User | None,
    tracking_url: str,
) -> NotificationContent:
    driver_name = (
        driver.full_name
        if driver is not None
        else (vehicle.driver_name if vehicle and vehicle.driver_name else "đang cập nhật")
    )
    driver_phone = driver.phone_number if driver and driver.phone_number else "đang cập nhật"
    license_plate = vehicle.license_plate if vehicle else "đang cập nhật"

    if template_code == ORDER_ASSIGNED:
        return NotificationContent(
            title="[LogiRoute VN] Đơn hàng đã sẵn sàng vận chuyển",
            message=(
                f"Chào {order.customer_name}, đơn hàng {order.order_code} đã được gán "
                f"cho tài xế {driver_name} (Xe: {license_plate}). Theo dõi hành trình "
                f"tại: {tracking_url}"
            ),
        )
    if template_code == ORDER_OUT_FOR_DELIVERY:
        return NotificationContent(
            title="[LogiRoute VN] Tài xế đang trên đường giao đến bạn",
            message=(
                f"Tài xế {driver_name} (SĐT: {driver_phone}) đang di chuyển đến địa chỉ "
                f"{order.address}. Xem vị trí xe trực tiếp: {tracking_url}"
            ),
        )
    if template_code == ORDER_DELIVERED:
        return NotificationContent(
            title="[LogiRoute VN] Giao hàng thành công",
            message=(
                f"Đơn hàng {order.order_code} đã được giao thành công. "
                "Cảm ơn quý khách đã sử dụng dịch vụ!"
            ),
        )
    if template_code == ORDER_FAILED:
        failure_reason = order.failure_reason or "chưa xác định"
        return NotificationContent(
            title="[LogiRoute VN] Giao hàng chưa thành công",
            message=(
                f"Đơn hàng {order.order_code} chưa thể giao do: {failure_reason}. "
                "Điều phối viên sẽ liên hệ lại quý khách sớm nhất."
            ),
        )
    raise ValueError(f"Unsupported notification template: {template_code}")


def send_order_notification(
    db: Session,
    *,
    order: Order,
    template_code: str,
    channel: NotificationChannel = NotificationChannel.ZALO_ZNS,
    vehicle: Vehicle | None = None,
    driver: User | None = None,
    delivery_status: NotificationStatus = NotificationStatus.SENT,
) -> CustomerNotification | None:
    """Persist a simulated notification without performing external network I/O."""
    recipient_phone = (order.customer_phone or "").strip()
    if not recipient_phone:
        return None

    vehicle, driver = _resolve_delivery_people(
        db,
        order=order,
        vehicle=vehicle,
        driver=driver,
    )
    tracking_url = f"{PUBLIC_TRACKING_BASE_URL}/track/{order.tracking_token}"
    content = _build_content(
        template_code=template_code,
        order=order,
        vehicle=vehicle,
        driver=driver,
        tracking_url=tracking_url,
    )
    notification = CustomerNotification(
        order_id=order.id,
        recipient_phone=recipient_phone,
        channel=channel,
        template_code=template_code,
        title=content.title,
        message_content=content.message,
        # Keep the deterministic tracking URL on every record so dispatchers
        # can always open/copy it from notification history.
        tracking_url=tracking_url,
        status=delivery_status,
    )
    db.add(notification)
    db.flush()
    return notification
