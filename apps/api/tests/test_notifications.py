from sqlalchemy import create_engine, inspect, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.v1.driver import update_driver_order_status
from app.api.v1.orders import (
    dispatch_order,
    get_order_notifications,
    resend_order_notification,
)
from app.core.security import get_password_hash
from app.db.base import Base
from app.db.models import (
    CustomerNotification,
    NotificationChannel,
    NotificationStatus,
    Order,
    OrderStatus,
    User,
    UserRole,
    UserStatus,
    Vehicle,
    VehicleStatus,
)
from app.schemas import (
    DriverOrderStatus,
    DriverOrderStatusUpdate,
    NotificationResendRequest,
    OrderDispatchRequest,
)
from app.services.notification_service import send_order_notification


def _db() -> Session:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return Session(engine)


def _user(db: Session, *, role: UserRole, email: str, phone: str | None = None) -> User:
    user = User(
        email=email,
        hashed_password=get_password_hash("123456"),
        full_name=email.split("@")[0].replace(".", " ").title(),
        phone_number=phone,
        role=role,
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    db.flush()
    return user


def test_notification_model_cascades_with_order() -> None:
    with _db() as db:
        foreign_keys = inspect(db.bind).get_foreign_keys("customer_notifications")
        assert foreign_keys[0]["referred_table"] == "orders"
        assert foreign_keys[0]["options"]["ondelete"] == "CASCADE"


def test_notification_service_skips_missing_phone_and_builds_tracking_link() -> None:
    with _db() as db:
        without_phone = Order(
            order_code="NOTICE-NO-PHONE",
            customer_name="No Phone",
            address="Quan 1",
            latitude=10.77,
            longitude=106.70,
            weight_kg=5,
            status=OrderStatus.ASSIGNED,
        )
        with_phone = Order(
            order_code="NOTICE-WITH-PHONE",
            customer_name="Nguyen Van A",
            customer_phone="0901234567",
            address="Quan 3",
            latitude=10.78,
            longitude=106.68,
            weight_kg=8,
            status=OrderStatus.DELIVERED,
        )
        db.add_all([without_phone, with_phone])
        db.flush()

        assert send_order_notification(
            db,
            order=without_phone,
            template_code="ORDER_ASSIGNED",
        ) is None
        notification = send_order_notification(
            db,
            order=with_phone,
            template_code="ORDER_DELIVERED",
            channel=NotificationChannel.SMS_BRANDNAME,
        )
        db.commit()

        assert notification is not None
        assert notification.recipient_phone == "0901234567"
        assert notification.channel is NotificationChannel.SMS_BRANDNAME
        assert notification.status is NotificationStatus.SENT
        assert notification.tracking_url == (
            f"http://localhost:3001/track/{with_phone.tracking_token}"
        )
        assert with_phone.order_code in notification.message_content


def test_dispatch_and_driver_status_changes_create_notifications() -> None:
    with _db() as db:
        dispatcher = _user(
            db,
            role=UserRole.DISPATCHER,
            email="notification.dispatcher@test.vn",
        )
        driver = _user(
            db,
            role=UserRole.DRIVER,
            email="notification.driver@test.vn",
            phone="0987654321",
        )
        vehicle = Vehicle(
            license_plate="51D-NOTICE",
            capacity_kg=1000,
            driver_name=driver.full_name,
            driver_id=driver.id,
            status=VehicleStatus.IDLE,
        )
        order = Order(
            order_code="NOTICE-FLOW-001",
            customer_name="Khach Hang",
            customer_phone="0909000000",
            address="Quan 1, Ho Chi Minh City",
            latitude=10.7769,
            longitude=106.7009,
            weight_kg=10,
            status=OrderStatus.PENDING,
        )
        db.add_all([vehicle, order])
        db.commit()

        dispatch_order(
            order_id=order.id,
            payload=OrderDispatchRequest(driver_id=driver.id),
            db=db,
            _current_user=dispatcher,
        )
        update_driver_order_status(
            order_id=order.id,
            payload=DriverOrderStatusUpdate(
                status=DriverOrderStatus.DELIVERING,
            ),
            db=db,
            current_user=driver,
        )
        update_driver_order_status(
            order_id=order.id,
            payload=DriverOrderStatusUpdate(
                status=DriverOrderStatus.DELIVERED,
                pod_url="http://localhost:8000/uploads/pod/notice.jpg",
            ),
            db=db,
            current_user=driver,
        )

        notifications = list(
            db.scalars(
                select(CustomerNotification)
                .where(CustomerNotification.order_id == order.id)
                .order_by(CustomerNotification.sent_at, CustomerNotification.id)
            ).all()
        )
        assert [item.template_code for item in notifications] == [
            "ORDER_ASSIGNED",
            "ORDER_OUT_FOR_DELIVERY",
            "ORDER_DELIVERED",
        ]
        assert driver.full_name in notifications[0].message_content
        assert driver.phone_number in notifications[1].message_content


def test_notification_history_and_resend_use_requested_channel() -> None:
    with _db() as db:
        dispatcher = _user(
            db,
            role=UserRole.DISPATCHER,
            email="notification.resend@test.vn",
        )
        order = Order(
            order_code="NOTICE-RESEND-001",
            customer_name="Resend Customer",
            customer_phone="0911222333",
            address="Quan 5",
            latitude=10.75,
            longitude=106.67,
            weight_kg=4,
            status=OrderStatus.FAILED,
            failure_reason="Khach khong nghe may",
        )
        db.add(order)
        db.commit()

        resent = resend_order_notification(
            order_id=order.id,
            payload=NotificationResendRequest(
                channel=NotificationChannel.SMS_BRANDNAME,
            ),
            db=db,
            _current_user=dispatcher,
        )
        history = get_order_notifications(
            order_id=order.id,
            db=db,
            _current_user=dispatcher,
        )

        assert resent.channel is NotificationChannel.SMS_BRANDNAME
        assert resent.template_code == "ORDER_FAILED"
        assert "Khach khong nghe may" in resent.message_content
        assert [item.id for item in history] == [resent.id]
