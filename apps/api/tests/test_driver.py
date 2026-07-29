from app.main import app
from app.schemas import DriverOrderStatus, DriverOrderStatusUpdate


def test_driver_status_schema_accepts_delivery_actions() -> None:
    payload = DriverOrderStatusUpdate(
        status=DriverOrderStatus.DELIVERED,
        delivery_note="Đã giao cho lễ tân",
        pod_url="https://example.com/pod/order-1.jpg",
    )

    assert payload.status is DriverOrderStatus.DELIVERED
    assert str(payload.pod_url) == "https://example.com/pod/order-1.jpg"


def test_driver_api_contract_is_exposed_in_openapi() -> None:
    paths = app.openapi()["paths"]

    assert "/api/v1/driver/route" in paths
    assert "get" in paths["/api/v1/driver/route"]
    assert "/api/v1/driver/orders/{order_id}/status" in paths
    assert "patch" in paths["/api/v1/driver/orders/{order_id}/status"]
    assert "/api/v1/driver/orders/{order_id}/pod" in paths
    assert "post" in paths["/api/v1/driver/orders/{order_id}/pod"]
