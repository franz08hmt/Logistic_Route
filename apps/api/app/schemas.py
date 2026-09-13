from datetime import datetime
from enum import Enum
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.db.models import (
    CodStatus,
    NotificationChannel,
    NotificationStatus,
    OrderStatus,
    PaymentMethod,
    SettlementStatus,
    UserRole,
    UserStatus,
    VehicleStatus,
)
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


class DepotBase(BaseModel):
    code: str = Field(min_length=3, max_length=20, pattern=r"^[A-Z0-9-]+$")
    name: str = Field(min_length=2, max_length=150)
    city: str = Field(min_length=2, max_length=100)
    address: str = Field(min_length=3, max_length=1000)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    is_default: bool = False

    @field_validator("code", mode="before")
    @classmethod
    def normalize_depot_code(cls, value: object) -> object:
        return value.strip().upper() if isinstance(value, str) else value

    @field_validator("name", "city", "address")
    @classmethod
    def normalize_depot_text(cls, value: str) -> str:
        return value.strip()


class DepotCreate(DepotBase):
    pass


class DepotUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=3, max_length=20, pattern=r"^[A-Z0-9-]+$")
    name: str | None = Field(default=None, min_length=2, max_length=150)
    city: str | None = Field(default=None, min_length=2, max_length=100)
    address: str | None = Field(default=None, min_length=3, max_length=1000)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    is_default: bool | None = None

    @field_validator("code", mode="before")
    @classmethod
    def normalize_depot_code(cls, value: object) -> object:
        return value.strip().upper() if isinstance(value, str) else value

    @field_validator("name", "city", "address")
    @classmethod
    def normalize_optional_depot_text(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None

    @model_validator(mode="after")
    def require_at_least_one_change(self) -> "DepotUpdate":
        if not self.model_fields_set:
            raise ValueError("at least one depot field must be provided")
        return self


class DepotRead(DepotBase, OrmSchema):
    id: UUID
    vehicle_count: int = Field(default=0, ge=0)
    active_orders_count: int = Field(default=0, ge=0)
    total_vehicle_capacity_kg: float = Field(default=0, ge=0)


class VehicleCreate(BaseModel):
    depot_id: UUID | None = None
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


class DriverTelemetryPing(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    speed_kmh: float | None = Field(default=0.0, ge=0)


RouteDeviationStatus = Literal["ON_ROUTE", "OFF_ROUTE_WARNING", "STOPPED"]


class VehicleTelemetryItem(BaseModel):
    vehicle_id: UUID
    license_plate: str
    driver_name: str | None
    status: VehicleStatus
    current_latitude: float | None = Field(default=None, ge=-90, le=90)
    current_longitude: float | None = Field(default=None, ge=-180, le=180)
    speed_kmh: float | None = Field(default=None, ge=0)
    last_gps_ping_at: datetime | None
    route_deviation_status: RouteDeviationStatus | None
    next_stop_address: str | None
    next_stop_sequence: int | None = Field(default=None, ge=1)


class VehicleTelemetryResponse(BaseModel):
    generated_at: datetime
    vehicles: list[VehicleTelemetryItem]


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
    depot_id: UUID | None = None
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
    # VND has no sub-unit, and NUMERIC(12, 0) caps a single order at 12 digits.
    cod_amount: int = Field(default=0, ge=0, le=999_999_999_999)
    payment_method: PaymentMethod = PaymentMethod.COD_CASH

    @model_validator(mode="after")
    def require_zero_cod_for_prepaid(self) -> "OrderCreate":
        if self.payment_method is PaymentMethod.PREPAID and self.cod_amount != 0:
            raise ValueError("a prepaid order cannot carry a COD amount")
        return self

    @field_validator("status")
    @classmethod
    def require_pending_status(cls, value: OrderStatus) -> OrderStatus:
        if value is not OrderStatus.PENDING:
            raise ValueError("new orders must start in PENDING status")
        return value


class OrderDispatchRequest(BaseModel):
    driver_id: UUID
    force_region_mismatch: bool = False


class OrderRead(OrderBase, OrmSchema):
    id: UUID
    tracking_token: str = Field(min_length=32, max_length=64)
    status_updated_at: datetime | None
    assigned_vehicle_id: UUID | None = None
    route_batch_id: UUID | None = None
    stop_sequence: int | None = Field(default=None, ge=1)
    delivery_note: str | None = None
    failure_reason: str | None = None
    pod_url: str | None = None
    pod_uploaded_at: datetime | None = None
    signature_url: str | None = None
    signature_uploaded_at: datetime | None = None
    recipient_name: str | None = None
    delivery_region: str | None = None
    cod_amount: int = Field(default=0, ge=0)
    payment_method: PaymentMethod = PaymentMethod.COD_CASH
    cod_status: CodStatus = CodStatus.PENDING
    cod_collected_at: datetime | None = None
    cod_reconciled_at: datetime | None = None
    cod_receipt_note: str | None = None
    shift_settlement_id: UUID | None = None


class BulkImportRowError(BaseModel):
    row: int = Field(ge=1)
    order_code: str | None
    errors: list[str] = Field(min_length=1)


class BulkImportResponse(BaseModel):
    total_rows: int = Field(ge=0)
    created_count: int = Field(ge=0)
    error_count: int = Field(ge=0)
    errors: list[BulkImportRowError]


class OrderActivityRead(OrmSchema):
    id: UUID
    action: str
    old_status: str | None
    new_status: str | None
    actor_name: str | None
    actor_role: str | None
    detail: str | None
    created_at: datetime


class OrderActivityListResponse(BaseModel):
    order_id: UUID
    order_code: str
    activities: list[OrderActivityRead]


class CustomerNotificationRead(OrmSchema):
    id: UUID
    order_id: UUID
    recipient_phone: str
    channel: NotificationChannel
    template_code: str
    title: str
    message_content: str
    tracking_url: str | None
    status: NotificationStatus
    sent_at: datetime


class NotificationResendRequest(BaseModel):
    channel: NotificationChannel = NotificationChannel.ZALO_ZNS


class PublicTrackingOrder(BaseModel):
    order_code: str
    customer_name_masked: str
    customer_phone_masked: str | None
    address: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    status: OrderStatus
    status_updated_at: datetime | None
    delivery_note: str | None
    failure_reason: str | None


class PublicTrackingDriver(BaseModel):
    driver_name: str
    driver_phone: str | None
    license_plate: str
    vehicle_type: str


class PublicTrackingResponse(BaseModel):
    order: PublicTrackingOrder
    depot: DepotRead
    driver: PublicTrackingDriver | None
    stops_remaining_before: int = Field(ge=0)
    route_batch_id: UUID | None
    estimated_arrival_minutes: int | None = Field(default=None, ge=0)


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


class DriverDetailRead(BaseModel):
    id: UUID
    full_name: str
    email: str
    phone_number: str | None
    status: UserStatus
    created_at: datetime
    vehicle_id: UUID | None
    license_plate: str | None
    vehicle_type: str | None
    vehicle_status: VehicleStatus | None
    capacity_kg: float | None
    service_area: str | None
    active_orders_count: int = Field(ge=0)
    delivered_today_count: int = Field(ge=0)
    failed_today_count: int = Field(ge=0)


class DriverPerformanceItem(BaseModel):
    driver_id: UUID
    driver_name: str
    email: str
    phone_number: str | None
    license_plate: str | None
    vehicle_type: str | None
    total_orders_handled: int = Field(ge=0)
    delivered_count: int = Field(ge=0)
    failed_count: int = Field(ge=0)
    success_rate: float = Field(ge=0, le=100)
    route_adherence_score: float = Field(ge=0, le=100)
    total_distance_km: float = Field(ge=0)
    estimated_co2_saved_kg: float = Field(ge=0)
    overall_score: float = Field(ge=0, le=100)
    tier_badge: Literal["GOLD", "SILVER", "BRONZE"]
    is_eco_driver: bool
    rank: int = Field(ge=1)


class DriverPerformanceResponse(BaseModel):
    period_days: Literal[7, 14, 30]
    total_co2_saved_all_kg: float = Field(ge=0)
    drivers: list[DriverPerformanceItem]


class ServiceHealthItem(BaseModel):
    service_key: Literal[
        "database",
        "core_engine",
        "osrm_routing",
        "telemetry",
        "notifications",
        "storage",
    ]
    name: str
    status: Literal["HEALTHY", "DEGRADED", "DOWN"]
    latency_ms: float | None = Field(default=None, ge=0)
    details: dict[str, Any]
    last_checked_at: datetime


class SystemHealthResponse(BaseModel):
    overall_status: Literal["HEALTHY", "DEGRADED", "DOWN"]
    uptime_seconds: int = Field(ge=0)
    server_time: datetime
    services: list[ServiceHealthItem] = Field(min_length=6, max_length=6)


class DiagnosticTestResult(BaseModel):
    test_key: Literal[
        "database_spatial",
        "core_engine_solve",
        "routing_polyline",
        "tracking_token",
        "storage_permissions",
    ]
    name: str
    status: Literal["PASS", "FAIL"]
    duration_ms: float = Field(ge=0)
    detail: str


class SystemDiagnosticsResponse(BaseModel):
    overall_status: Literal["PASS", "FAIL"]
    started_at: datetime
    completed_at: datetime
    total_duration_ms: float = Field(ge=0)
    passed_count: int = Field(ge=0)
    failed_count: int = Field(ge=0)
    tests: list[DiagnosticTestResult] = Field(min_length=5, max_length=5)


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
    depots_created: int = Field(default=0, ge=0)
    vehicles_created: int
    orders_created: int
    analytics_snapshots_created: int = Field(default=0, ge=0)
    depot: DepotRead


class ScenarioType(str, Enum):
    HCMC_PEAK_DAY = "HCMC_PEAK_DAY"
    HANOI_EXPRESS = "HANOI_EXPRESS"
    MULTI_REGION = "MULTI_REGION"


class ScenarioLoadResponse(BaseModel):
    scenario_name: ScenarioType
    depot_name: str
    vehicles_loaded: int = Field(ge=0)
    orders_loaded: int = Field(ge=0)
    delivered_orders: int = Field(ge=0)
    active_telemetry_vehicles: int = Field(ge=0)
    message: str


class AnalyticsDataPoint(BaseModel):
    date: str
    total_distance_km: float = Field(ge=0)
    total_duration_mins: float = Field(ge=0)
    total_cost_vnd: float = Field(ge=0)
    fuel_cost_vnd: float = Field(ge=0)
    driver_cost_vnd: float = Field(ge=0)
    co2_emissions_kg: float = Field(ge=0)
    estimated_savings_vnd: float = Field(ge=0)
    estimated_co2_savings_kg: float = Field(ge=0)
    optimization_runs: int = Field(ge=0)


class AnalyticsSummary(BaseModel):
    period_label: str
    total_optimizations: int = Field(ge=0)
    total_distance_km: float = Field(ge=0)
    total_cost_vnd: float = Field(ge=0)
    total_savings_vnd: float = Field(ge=0)
    total_co2_saved_kg: float = Field(ge=0)
    avg_savings_rate: float = Field(ge=0, le=1)
    best_day: str | None
    best_day_savings_vnd: float = Field(ge=0)


class AnalyticsHistoryResponse(BaseModel):
    summary: AnalyticsSummary
    data_points: list[AnalyticsDataPoint]


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
    route_batch_id: UUID | None = None
    depot: DepotRead
    total_distance_km: float
    total_duration_mins: float
    cost_metrics: RouteCostMetrics
    unassigned_orders: list[str]
    routes: list[OptimizedRoute]


class StopReorderInput(BaseModel):
    order_id: UUID
    stop_sequence: int = Field(ge=1)


class VehicleRouteReorderInput(BaseModel):
    vehicle_id: UUID
    stops: list[StopReorderInput] = Field(max_length=100)

    @model_validator(mode="after")
    def require_contiguous_unique_sequences(self) -> "VehicleRouteReorderInput":
        order_ids = [stop.order_id for stop in self.stops]
        if len(set(order_ids)) != len(order_ids):
            raise ValueError("route stops must contain unique order_ids")
        sequences = sorted(stop.stop_sequence for stop in self.stops)
        if sequences != list(range(1, len(self.stops) + 1)):
            raise ValueError("stop_sequence values must be contiguous starting at 1")
        return self


class RouteReorderRequest(BaseModel):
    route_batch_id: UUID
    routes: list[VehicleRouteReorderInput] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def require_unique_routes_and_orders(self) -> "RouteReorderRequest":
        vehicle_ids = [route.vehicle_id for route in self.routes]
        if len(set(vehicle_ids)) != len(vehicle_ids):
            raise ValueError("routes must contain unique vehicle_ids")
        order_ids = [stop.order_id for route in self.routes for stop in route.stops]
        if not order_ids:
            raise ValueError("at least one route stop is required")
        if len(set(order_ids)) != len(order_ids):
            raise ValueError("an order can only appear once across routes")
        return self


class MultiStopDispatchRequest(BaseModel):
    order_ids: list[UUID] = Field(min_length=2, max_length=100)
    driver_id: UUID
    force_region_mismatch: bool = False

    @field_validator("order_ids")
    @classmethod
    def require_unique_order_ids(cls, value: list[UUID]) -> list[UUID]:
        if len(set(value)) != len(value):
            raise ValueError("order_ids must be unique")
        return value


class MultiStopDispatchStop(BaseModel):
    order_id: UUID
    order_code: str
    stop_sequence: int = Field(ge=1)
    customer_name: str
    address: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    weight_kg: float = Field(gt=0)


class MultiStopDispatchResponse(BaseModel):
    status: str
    route_batch_id: UUID
    driver_id: UUID
    driver_name: str
    vehicle_id: UUID
    license_plate: str
    depot: DepotRead
    total_distance_km: float = Field(ge=0)
    total_duration_mins: float = Field(ge=0)
    total_weight_kg: float = Field(gt=0)
    cost_metrics: RouteCostMetrics
    stops: list[MultiStopDispatchStop]


class DriverOrderStatus(str, Enum):
    DELIVERING = "DELIVERING"
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"


class DriverOrderStatusUpdate(BaseModel):
    status: DriverOrderStatus
    delivery_note: str | None = Field(default=None, max_length=2000)
    failure_reason: str | None = Field(default=None, max_length=500)
    pod_url: str | None = Field(default=None, max_length=1000)
    # Optional so the driver can record how a COD order was paid in the same
    # call that marks it delivered.
    payment_method: Literal[PaymentMethod.COD_CASH, PaymentMethod.VIETQR] | None = None
    cod_receipt_note: str | None = Field(default=None, max_length=500)

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


class SignatureUploadRead(BaseModel):
    signature_url: str
    uploaded_at: datetime


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
    pod_uploaded_at: datetime | None
    signature_url: str | None
    signature_uploaded_at: datetime | None
    recipient_name: str | None
    cod_amount: int = Field(default=0, ge=0)
    payment_method: PaymentMethod = PaymentMethod.COD_CASH
    cod_status: CodStatus = CodStatus.PENDING
    cod_collected_at: datetime | None = None
    cod_receipt_note: str | None = None


class DriverRouteRead(BaseModel):
    vehicle: DriverVehicleRead | None
    depot: DepotRead | None
    total_orders: int
    completed_orders: int
    stops: list[DriverStopRead]


class CodSummaryRead(BaseModel):
    """Depot-scoped cash position across the COD lifecycle."""

    depot_id: UUID | None = None
    depot_name: str | None = None
    total_cod_expected: int = Field(ge=0)
    total_cash_in_hand: int = Field(ge=0)
    total_vietqr_paid: int = Field(ge=0)
    total_reconciled: int = Field(ge=0)
    pending_settlements_count: int = Field(ge=0)
    pending_orders_count: int = Field(ge=0)


class CodCollectionRequest(BaseModel):
    payment_method: Literal[PaymentMethod.COD_CASH, PaymentMethod.VIETQR]
    cod_receipt_note: str | None = Field(default=None, max_length=500)


class VietQrRead(BaseModel):
    """Everything the client needs to render and explain a VietQR code."""

    order_code: str
    amount: int = Field(gt=0)
    bank_code: str
    bank_bin: str
    account_no: str
    account_name: str
    add_info: str
    payload: str = Field(min_length=1)
    image_url: str


class DriverShiftOrderRead(OrmSchema):
    id: UUID
    order_code: str
    customer_name: str
    address: str
    status: OrderStatus
    cod_amount: int = Field(ge=0)
    payment_method: PaymentMethod
    cod_status: CodStatus


class ShiftSettlementPreviewRead(BaseModel):
    """Server-computed cash position for the driver's open shift."""

    depot_id: UUID | None = None
    depot_name: str | None = None
    vehicle_id: UUID | None = None
    license_plate: str | None = None
    total_orders_count: int = Field(ge=0)
    delivered_count: int = Field(ge=0)
    failed_count: int = Field(ge=0)
    total_cod_expected: int = Field(ge=0)
    expected_cash_amount: int = Field(ge=0)
    total_vietqr_collected: int = Field(ge=0)
    can_submit: bool
    orders: list[DriverShiftOrderRead] = Field(default_factory=list)


class ShiftSettlementSubmitRequest(BaseModel):
    # Only the declared cash is driver input. Expected totals are recomputed
    # server-side so the cashier can see any shortfall.
    total_cash_collected: int = Field(ge=0, le=999_999_999_999)
    notes: str | None = Field(default=None, max_length=1000)


class ShiftSettlementReviewRequest(BaseModel):
    review_note: str | None = Field(default=None, max_length=1000)


class ShiftSettlementRead(OrmSchema):
    id: UUID
    settlement_code: str
    depot_id: UUID
    depot_name: str | None = None
    driver_id: UUID
    driver_name: str | None = None
    driver_email: str | None = None
    vehicle_id: UUID
    license_plate: str | None = None
    total_orders_count: int = Field(ge=0)
    delivered_count: int = Field(ge=0)
    failed_count: int = Field(ge=0)
    total_cod_expected: int = Field(ge=0)
    expected_cash_amount: int = Field(ge=0)
    total_cash_collected: int = Field(ge=0)
    total_vietqr_collected: int = Field(ge=0)
    variance_amount: int
    status: SettlementStatus
    submitted_at: datetime
    approved_at: datetime | None = None
    approved_by_id: UUID | None = None
    approved_by_name: str | None = None
    notes: str | None = None
    review_note: str | None = None


class CodLedgerItemRead(BaseModel):
    order_id: UUID
    order_code: str
    customer_name: str
    address: str
    depot_id: UUID | None = None
    depot_name: str | None = None
    license_plate: str | None = None
    driver_name: str | None = None
    status: OrderStatus
    cod_amount: int = Field(ge=0)
    payment_method: PaymentMethod
    cod_status: CodStatus
    cod_collected_at: datetime | None = None
    cod_reconciled_at: datetime | None = None
    settlement_code: str | None = None
