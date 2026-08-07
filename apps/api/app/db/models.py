import uuid
from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import DateTime, Double, Enum as SqlEnum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.services.public_tracking import generate_tracking_token


class VehicleStatus(str, Enum):
    IDLE = "IDLE"
    ON_ROUTE = "ON_ROUTE"


class OrderStatus(str, Enum):
    PENDING = "PENDING"
    ASSIGNED = "ASSIGNED"
    DELIVERING = "DELIVERING"
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    DISPATCHER = "DISPATCHER"
    DRIVER = "DRIVER"


class UserStatus(str, Enum):
    PENDING_APPROVAL = "PENDING_APPROVAL"
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"


class NotificationChannel(str, Enum):
    ZALO_ZNS = "ZALO_ZNS"
    SMS_BRANDNAME = "SMS_BRANDNAME"


class NotificationStatus(str, Enum):
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    phone_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    role: Mapped[UserRole] = mapped_column(
        SqlEnum(UserRole, native_enum=False, length=16),
        nullable=False,
        default=UserRole.DISPATCHER,
    )
    status: Mapped[UserStatus] = mapped_column(
        SqlEnum(UserStatus, native_enum=False, length=24),
        nullable=False,
        default=UserStatus.PENDING_APPROVAL,
        server_default=UserStatus.PENDING_APPROVAL.value,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class Depot(Base):
    __tablename__ = "depots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    latitude: Mapped[float] = mapped_column(Double, nullable=False)
    longitude: Mapped[float] = mapped_column(Double, nullable=False)


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    license_plate: Mapped[str] = mapped_column(String(30), unique=True, index=True, nullable=False)
    capacity_kg: Mapped[float] = mapped_column(Double, nullable=False)
    vehicle_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="TRUCK", server_default="TRUCK"
    )
    driver_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    driver_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[VehicleStatus] = mapped_column(
        SqlEnum(VehicleStatus, native_enum=False, length=16),
        nullable=False,
        default=VehicleStatus.IDLE,
    )
    service_area: Mapped[str | None] = mapped_column(String(150), nullable=True)
    assignment_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    current_latitude: Mapped[float | None] = mapped_column(Double, nullable=True)
    current_longitude: Mapped[float | None] = mapped_column(Double, nullable=True)
    current_speed_kmh: Mapped[float | None] = mapped_column(
        Double,
        nullable=True,
        default=0.0,
        server_default="0",
    )
    last_gps_ping_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )
    route_deviation_status: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
        default="ON_ROUTE",
        server_default="ON_ROUTE",
    )


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    tracking_token: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        index=True,
        nullable=False,
        default=generate_tracking_token,
    )
    customer_name: Mapped[str] = mapped_column(String(150), nullable=False)
    customer_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    latitude: Mapped[float] = mapped_column(Double, nullable=False)
    longitude: Mapped[float] = mapped_column(Double, nullable=False)
    weight_kg: Mapped[float] = mapped_column(Double, nullable=False)
    status: Mapped[OrderStatus] = mapped_column(
        SqlEnum(OrderStatus, native_enum=False, length=16),
        nullable=False,
        default=OrderStatus.PENDING,
    )
    status_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        index=True,
    )
    assigned_vehicle_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vehicles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    route_batch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )
    stop_sequence: Mapped[int | None] = mapped_column(nullable=True)
    delivery_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    pod_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    pod_uploaded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    delivery_region: Mapped[str | None] = mapped_column(String(150), nullable=True)


class OrderActivityLog(Base):
    __tablename__ = "order_activity_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    old_status: Mapped[str | None] = mapped_column(String(16), nullable=True)
    new_status: Mapped[str | None] = mapped_column(String(16), nullable=True)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )
    actor_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    actor_role: Mapped[str | None] = mapped_column(String(16), nullable=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )


class CustomerNotification(Base):
    __tablename__ = "customer_notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    recipient_phone: Mapped[str] = mapped_column(String(30), nullable=False)
    channel: Mapped[NotificationChannel] = mapped_column(
        SqlEnum(NotificationChannel, native_enum=False, length=20),
        nullable=False,
        default=NotificationChannel.ZALO_ZNS,
    )
    template_code: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message_content: Mapped[str] = mapped_column(Text, nullable=False)
    tracking_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[NotificationStatus] = mapped_column(
        SqlEnum(NotificationStatus, native_enum=False, length=20),
        nullable=False,
        default=NotificationStatus.SENT,
    )
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        index=True,
    )


class RouteAnalyticsSnapshot(Base):
    __tablename__ = "route_analytics_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    total_distance_km: Mapped[float] = mapped_column(Double, nullable=False)
    total_duration_mins: Mapped[float] = mapped_column(Double, nullable=False)
    fuel_cost_vnd: Mapped[float] = mapped_column(Double, nullable=False)
    driver_cost_vnd: Mapped[float] = mapped_column(Double, nullable=False)
    total_cost_vnd: Mapped[float] = mapped_column(Double, nullable=False)
    co2_emissions_kg: Mapped[float] = mapped_column(Double, nullable=False)
    estimated_savings_vnd: Mapped[float] = mapped_column(Double, nullable=False)
    estimated_co2_savings_kg: Mapped[float] = mapped_column(Double, nullable=False)
    savings_rate: Mapped[float] = mapped_column(Double, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )
