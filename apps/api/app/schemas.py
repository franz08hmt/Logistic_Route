from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.db.models import OrderStatus, UserRole, UserStatus, VehicleStatus
from core_engine.solver import Route as OptimizedRoute


class OrmSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=6, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
            raise ValueError("email must be valid")
        return normalized


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=150)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=6, max_length=128)
    phone_number: str | None = Field(default=None, max_length=30)
    role: UserRole

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 2:
            raise ValueError("full_name must contain at least 2 characters")
        return normalized

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
            raise ValueError("email must be valid")
        return normalized

    @field_validator("phone_number")
    @classmethod
    def normalize_phone_number(cls, value: str | None) -> str | None:
        normalized = value.strip() if value else None
        return normalized or None

    @field_validator("role")
    @classmethod
    def restrict_self_registration_role(cls, value: UserRole) -> UserRole:
        if value not in {UserRole.DISPATCHER, UserRole.DRIVER}:
            raise ValueError("role must be DISPATCHER or DRIVER")
        return value


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserRead(OrmSchema):
    id: UUID
    email: str
    full_name: str
    phone_number: str | None
    role: UserRole
    status: UserStatus
    created_at: datetime


class UserStatusUpdate(BaseModel):
    status: UserStatus

    @field_validator("status")
    @classmethod
    def restrict_admin_status_update(cls, value: UserStatus) -> UserStatus:
        if value not in {UserStatus.ACTIVE, UserStatus.SUSPENDED}:
            raise ValueError("status must be ACTIVE or SUSPENDED")
        return value


class SeedUsersResponse(BaseModel):
    created_count: int
    users: list[UserRead]


class DepotRead(OrmSchema):
    id: UUID
    name: str
    address: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class VehicleCreate(BaseModel):
    license_plate: str = Field(min_length=2, max_length=30)
    capacity_kg: float = Field(gt=0)
    vehicle_type: str = Field(default="TRUCK", min_length=2, max_length=50)
    driver_name: str | None = Field(default=None, max_length=150)
    status: VehicleStatus = VehicleStatus.IDLE


class VehicleRead(VehicleCreate, OrmSchema):
    id: UUID
    driver_id: UUID | None = None
    service_area: str | None = None
    assignment_note: str | None = None


class VehicleAssignmentRequest(BaseModel):
    vehicle_id: UUID
    service_area: str | None = Field(default=None, max_length=150)
    assignment_note: str | None = Field(default=None, max_length=2000)

    @field_validator("service_area", "assignment_note")
    @classmethod
    def normalize_assignment_text(cls, value: str | None) -> str | None:
        normalized = value.strip() if value else None
        return normalized or None


class OrderBase(BaseModel):
    order_code: str = Field(min_length=2, max_length=50)
    customer_name: str = Field(min_length=1, max_length=150)
    customer_phone: str | None = Field(default=None, max_length=30)
    address: str = Field(min_length=1)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    weight_kg: float = Field(gt=0)
    status: OrderStatus = OrderStatus.PENDING


class OrderCreate(OrderBase):
    delivery_region: str | None = Field(default=None, max_length=150)
    assigned_driver_id: UUID | None = None
    force_region_mismatch: bool = False


class OrderRead(OrderBase, OrmSchema):
    id: UUID
    assigned_vehicle_id: UUID | None = None
    stop_sequence: int | None = Field(default=None, ge=1)
    delivery_note: str | None = None
    failure_reason: str | None = None
    pod_url: str | None = None
    delivery_region: str | None = None


class AvailableDriverRead(BaseModel):
    driver_id: UUID
    full_name: str
    phone_number: str | None
    vehicle_id: UUID
    license_plate: str
    vehicle_type: str
    capacity_kg: float
    service_area: str | None
    readiness: str = "READY"


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    failure_reason: str | None = Field(default=None, max_length=2000)


class OverviewRead(BaseModel):
    active_orders_count: int
    assigned_orders_count: int
    delivered_orders_count: int
    failed_orders_count: int
    vehicles_count: int
    drivers_online_count: int
    routes_optimized_count: int
    estimated_operating_cost_vnd: float = Field(ge=0)
    estimated_savings_vnd: float = Field(ge=0)
    co2_emissions_kg: float = Field(ge=0)
    estimated_co2_savings_kg: float = Field(ge=0)


class SeedResponse(BaseModel):
    depot_created: bool
    vehicles_created: int
    orders_created: int
    depot: DepotRead


class RouteCostMetrics(BaseModel):
    fuel_cost_vnd: float = Field(ge=0)
    driver_cost_vnd: float = Field(ge=0)
    total_cost_vnd: float = Field(ge=0)
    co2_emissions_kg: float = Field(ge=0)
    estimated_savings_vnd: float = Field(ge=0)
    estimated_co2_savings_kg: float = Field(ge=0)
    savings_rate: float = Field(ge=0, le=1)


class RouteOptimizationResponse(BaseModel):
    status: str
    depot: DepotRead
    total_distance_km: float
    total_duration_mins: float
    cost_metrics: RouteCostMetrics
    unassigned_orders: list[str]
    routes: list[OptimizedRoute]


class DriverOrderStatus(str, Enum):
    DELIVERING = "DELIVERING"
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"


class DriverOrderStatusUpdate(BaseModel):
    status: DriverOrderStatus
    delivery_note: str | None = Field(default=None, max_length=2000)
    failure_reason: str | None = Field(default=None, max_length=500)
    pod_url: str | None = Field(default=None, max_length=1000)

    @field_validator("delivery_note", "failure_reason", "pod_url")
    @classmethod
    def normalize_driver_update_text(cls, value: str | None) -> str | None:
        normalized = value.strip() if value else None
        return normalized or None

    @field_validator("pod_url")
    @classmethod
    def validate_pod_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if value.startswith("/uploads/pod/"):
            return value
        if value.startswith("https://") or value.startswith("http://"):
            return value
        raise ValueError("pod_url must be an HTTP URL or a LogiRoute upload path")


class PodUploadRead(BaseModel):
    pod_url: str
    content_type: str
    size_bytes: int = Field(gt=0)


class DriverVehicleRead(OrmSchema):
    id: UUID
    license_plate: str
    vehicle_type: str
    driver_name: str | None
    status: VehicleStatus


class DriverStopRead(OrmSchema):
    id: UUID
    order_code: str
    stop_sequence: int = Field(ge=1)
    customer_name: str
    customer_phone: str | None
    address: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    weight_kg: float = Field(gt=0)
    status: OrderStatus
    delivery_note: str | None
    failure_reason: str | None
    pod_url: str | None


class DriverRouteRead(BaseModel):
    vehicle: DriverVehicleRead | None
    depot: DepotRead | None
    total_orders: int
    completed_orders: int
    stops: list[DriverStopRead]
