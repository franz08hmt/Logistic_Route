import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Double, Enum as SqlEnum, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class VehicleStatus(str, Enum):
    IDLE = "IDLE"
    ON_ROUTE = "ON_ROUTE"


class OrderStatus(str, Enum):
    PENDING = "PENDING"
    ASSIGNED = "ASSIGNED"
    DELIVERED = "DELIVERED"


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    DISPATCHER = "DISPATCHER"
    DRIVER = "DRIVER"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SqlEnum(UserRole, native_enum=False, length=16),
        nullable=False,
        default=UserRole.DISPATCHER,
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
    driver_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    status: Mapped[VehicleStatus] = mapped_column(
        SqlEnum(VehicleStatus, native_enum=False, length=16),
        nullable=False,
        default=VehicleStatus.IDLE,
    )


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    customer_name: Mapped[str] = mapped_column(String(150), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    latitude: Mapped[float] = mapped_column(Double, nullable=False)
    longitude: Mapped[float] = mapped_column(Double, nullable=False)
    weight_kg: Mapped[float] = mapped_column(Double, nullable=False)
    status: Mapped[OrderStatus] = mapped_column(
        SqlEnum(OrderStatus, native_enum=False, length=16),
        nullable=False,
        default=OrderStatus.PENDING,
    )
