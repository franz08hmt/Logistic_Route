from datetime import datetime, timezone

from app.db.models import Order, OrderStatus


def set_order_status(order: Order, status: OrderStatus) -> None:
    """Apply one canonical order status transition timestamp."""
    order.status = status
    order.status_updated_at = datetime.now(timezone.utc)
