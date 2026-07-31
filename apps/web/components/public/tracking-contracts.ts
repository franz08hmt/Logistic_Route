export const PUBLIC_TRACKING_STATUSES = [
  'PENDING',
  'ASSIGNED',
  'DELIVERING',
  'DELIVERED',
  'FAILED',
] as const;

export type PublicTrackingStatus = (typeof PUBLIC_TRACKING_STATUSES)[number];

export type PublicTrackingResponse = {
  order: {
    order_code: string;
    customer_name_masked: string;
    customer_phone_masked: string | null;
    address: string;
    latitude: number;
    longitude: number;
    status: PublicTrackingStatus;
    status_updated_at: string | null;
    delivery_note: string | null;
    failure_reason: string | null;
  };
  depot: {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  driver: {
    driver_name: string;
    driver_phone: string | null;
    license_plate: string;
    vehicle_type: string;
  } | null;
  stops_remaining_before: number;
  route_batch_id: string | null;
  estimated_arrival_minutes: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}

function isNullableDate(value: unknown): value is string | null {
  return value === null
    || (typeof value === 'string' && !Number.isNaN(Date.parse(value)));
}

export function isPublicTrackingResponse(
  value: unknown,
): value is PublicTrackingResponse {
  if (!isRecord(value) || !isRecord(value.order) || !isRecord(value.depot)) {
    return false;
  }
  const { order, depot, driver } = value;
  const validDriver = driver === null || (
    isRecord(driver)
    && typeof driver.driver_name === 'string'
    && isNullableString(driver.driver_phone)
    && typeof driver.license_plate === 'string'
    && typeof driver.vehicle_type === 'string'
  );

  return (
    typeof order.order_code === 'string'
    && typeof order.customer_name_masked === 'string'
    && isNullableString(order.customer_phone_masked)
    && typeof order.address === 'string'
    && isFiniteNumber(order.latitude)
    && order.latitude >= -90
    && order.latitude <= 90
    && isFiniteNumber(order.longitude)
    && order.longitude >= -180
    && order.longitude <= 180
    && PUBLIC_TRACKING_STATUSES.includes(order.status as PublicTrackingStatus)
    && isNullableDate(order.status_updated_at)
    && isNullableString(order.delivery_note)
    && isNullableString(order.failure_reason)
    && typeof depot.id === 'string'
    && typeof depot.name === 'string'
    && typeof depot.address === 'string'
    && isFiniteNumber(depot.latitude)
    && isFiniteNumber(depot.longitude)
    && validDriver
    && Number.isInteger(value.stops_remaining_before)
    && (value.stops_remaining_before as number) >= 0
    && isNullableString(value.route_batch_id)
    && (
      value.estimated_arrival_minutes === null
      || (
        Number.isInteger(value.estimated_arrival_minutes)
        && (value.estimated_arrival_minutes as number) >= 0
      )
    )
  );
}
