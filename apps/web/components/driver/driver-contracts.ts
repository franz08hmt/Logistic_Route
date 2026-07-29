export const DRIVER_ORDER_STATUSES = [
  'ASSIGNED',
  'DELIVERING',
  'DELIVERED',
  'FAILED',
] as const;

export type DriverOrderStatus = (typeof DRIVER_ORDER_STATUSES)[number];

export type DriverStop = {
  id: string;
  order_code: string;
  stop_sequence: number;
  customer_name: string;
  customer_phone: string | null;
  address: string;
  latitude: number;
  longitude: number;
  weight_kg: number;
  status: DriverOrderStatus;
  delivery_note: string | null;
  failure_reason: string | null;
  pod_url: string | null;
  pod_uploaded_at: string | null;
};

export type DriverRoute = {
  vehicle: {
    id: string;
    license_plate: string;
    vehicle_type: string;
    driver_name: string | null;
    status: 'IDLE' | 'ON_ROUTE';
  } | null;
  depot: {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  } | null;
  total_orders: number;
  completed_orders: number;
  stops: DriverStop[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isDriverStop(value: unknown): value is DriverStop {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.order_code === 'string' &&
    typeof value.stop_sequence === 'number' &&
    Number.isInteger(value.stop_sequence) &&
    value.stop_sequence > 0 &&
    typeof value.customer_name === 'string' &&
    (typeof value.customer_phone === 'string' || value.customer_phone === null) &&
    typeof value.address === 'string' &&
    isFiniteNumber(value.latitude) &&
    isFiniteNumber(value.longitude) &&
    isFiniteNumber(value.weight_kg) &&
    DRIVER_ORDER_STATUSES.includes(value.status as DriverOrderStatus) &&
    (typeof value.delivery_note === 'string' || value.delivery_note === null) &&
    (typeof value.failure_reason === 'string' || value.failure_reason === null) &&
    (typeof value.pod_url === 'string' || value.pod_url === null) &&
    (typeof value.pod_uploaded_at === 'string' || value.pod_uploaded_at === null)
  );
}

export function isDriverRoute(value: unknown): value is DriverRoute {
  if (!isRecord(value)) {
    return false;
  }

  const vehicle = value.vehicle;
  const depot = value.depot;
  const validVehicle = vehicle === null || (
    isRecord(vehicle) &&
    typeof vehicle.id === 'string' &&
    typeof vehicle.license_plate === 'string' &&
    typeof vehicle.vehicle_type === 'string' &&
    (vehicle.driver_name === null || typeof vehicle.driver_name === 'string') &&
    (vehicle.status === 'IDLE' || vehicle.status === 'ON_ROUTE')
  );
  const validDepot = depot === null || (
    isRecord(depot) &&
    typeof depot.id === 'string' &&
    typeof depot.name === 'string' &&
    typeof depot.address === 'string' &&
    isFiniteNumber(depot.latitude) &&
    isFiniteNumber(depot.longitude)
  );
  return (
    validVehicle &&
    validDepot &&
    typeof value.total_orders === 'number' &&
    typeof value.completed_orders === 'number' &&
    Array.isArray(value.stops) &&
    value.stops.every(isDriverStop)
  );
}
