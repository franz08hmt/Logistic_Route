export const DRIVER_ACCOUNT_STATUSES = [
  'ACTIVE',
  'SUSPENDED',
  'PENDING_APPROVAL',
] as const;
export const DRIVER_VEHICLE_STATUSES = ['IDLE', 'ON_ROUTE'] as const;

export type DriverAccountStatus = (typeof DRIVER_ACCOUNT_STATUSES)[number];
export type DriverVehicleStatus = (typeof DRIVER_VEHICLE_STATUSES)[number];

export type DriverDetail = {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  status: DriverAccountStatus;
  created_at: string;
  vehicle_id: string | null;
  license_plate: string | null;
  vehicle_type: string | null;
  vehicle_status: DriverVehicleStatus | null;
  capacity_kg: number | null;
  service_area: string | null;
  active_orders_count: number;
  delivered_today_count: number;
  failed_today_count: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isDriverDetail(value: unknown): value is DriverDetail {
  return (
    isRecord(value)
    && typeof value.id === 'string'
    && typeof value.full_name === 'string'
    && typeof value.email === 'string'
    && isNullableString(value.phone_number)
    && DRIVER_ACCOUNT_STATUSES.includes(value.status as DriverAccountStatus)
    && typeof value.created_at === 'string'
    && !Number.isNaN(Date.parse(value.created_at))
    && isNullableString(value.vehicle_id)
    && isNullableString(value.license_plate)
    && isNullableString(value.vehicle_type)
    && (
      value.vehicle_status === null
      || DRIVER_VEHICLE_STATUSES.includes(value.vehicle_status as DriverVehicleStatus)
    )
    && (value.capacity_kg === null || (
      typeof value.capacity_kg === 'number'
      && Number.isFinite(value.capacity_kg)
      && value.capacity_kg > 0
    ))
    && isNullableString(value.service_area)
    && isNonNegativeInteger(value.active_orders_count)
    && isNonNegativeInteger(value.delivered_today_count)
    && isNonNegativeInteger(value.failed_today_count)
  );
}

export function isDriverDetailList(value: unknown): value is DriverDetail[] {
  return Array.isArray(value) && value.every(isDriverDetail);
}
