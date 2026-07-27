from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.db.models import OrderStatus, UserRole, VehicleStatus
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


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserRead(OrmSchema):
    id: UUID
    email: str
    full_name: str
    role: UserRole
    created_at: datetime


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
    driver_name: str | None = Field(default=None, max_length=150)
    status: VehicleStatus = VehicleStatus.IDLE


class VehicleRead(VehicleCreate, OrmSchema):
    id: UUID


class OrderCreate(BaseModel):
    order_code: str = Field(min_length=2, max_length=50)
    customer_name: str = Field(min_length=1, max_length=150)
    address: str = Field(min_length=1)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    weight_kg: float = Field(gt=0)
    status: OrderStatus = OrderStatus.PENDING


class OrderRead(OrderCreate, OrmSchema):
    id: UUID


class OverviewRead(BaseModel):
    active_orders_count: int
    vehicles_count: int
    drivers_online_count: int
    routes_optimized_count: int


class SeedResponse(BaseModel):
    depot_created: bool
    vehicles_created: int
    orders_created: int
    depot: DepotRead


class RouteOptimizationResponse(BaseModel):
    status: str
    depot: DepotRead
    total_distance_km: float
    total_duration_mins: float
    unassigned_orders: list[str]
    routes: list[OptimizedRoute]
