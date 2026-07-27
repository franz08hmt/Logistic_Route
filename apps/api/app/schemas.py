from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.db.models import OrderStatus, VehicleStatus


class OrmSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


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
