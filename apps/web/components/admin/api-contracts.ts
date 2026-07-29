import { apiFetch } from '../../lib/api-client';

export const ORDER_STATUSES = [
  'PENDING',
  'ASSIGNED',
  'DELIVERING',
  'DELIVERED',
  'FAILED',
] as const;
export const VEHICLE_STATUSES = ['IDLE', 'ON_ROUTE'] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export type Order = {
  id: string;
  order_code: string;
  customer_name: string;
  customer_phone: string | null;
  address: string;
  latitude: number;
  longitude: number;
  weight_kg: number;
  status: OrderStatus;
  assigned_vehicle_id: string | null;
  stop_sequence: number | null;
  delivery_note: string | null;
  failure_reason: string | null;
  pod_url: string | null;
  delivery_region: string | null;
};

export type CreateOrderInput = {
  order_code: string;
  customer_name: string;
  customer_phone?: string | null;
  address: string;
  latitude: number;
  longitude: number;
  weight_kg: number;
  delivery_region?: string | null;
  assigned_driver_id?: string | null;
  force_region_mismatch?: boolean;
};

export type Vehicle = {
  id: string;
  license_plate: string;
  capacity_kg: number;
  vehicle_type: string;
  driver_name: string | null;
  driver_id: string | null;
  status: VehicleStatus;
  service_area: string | null;
  assignment_note: string | null;
};

export type CreateVehicleInput = {
  license_plate: string;
  capacity_kg: number;
  vehicle_type: string;
  driver_name?: string | null;
};

export type AvailableDriver = {
  driver_id: string;
  full_name: string;
  phone_number: string | null;
  vehicle_id: string;
  license_plate: string;
  vehicle_type: string;
  capacity_kg: number;
  service_area: string | null;
  readiness: 'READY';
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOrder(value: unknown): value is Order {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.order_code === 'string' &&
    typeof value.customer_name === 'string' &&
    (typeof value.customer_phone === 'string' || value.customer_phone === null) &&
    typeof value.address === 'string' &&
    isFiniteNumber(value.latitude) &&
    isFiniteNumber(value.longitude) &&
    isFiniteNumber(value.weight_kg) &&
    ORDER_STATUSES.includes(value.status as OrderStatus) &&
    (typeof value.assigned_vehicle_id === 'string' || value.assigned_vehicle_id === null) &&
    (typeof value.stop_sequence === 'number' || value.stop_sequence === null) &&
    (typeof value.delivery_note === 'string' || value.delivery_note === null) &&
    (typeof value.failure_reason === 'string' || value.failure_reason === null) &&
    (typeof value.pod_url === 'string' || value.pod_url === null) &&
    (typeof value.delivery_region === 'string' || value.delivery_region === null)
  );
}

function isVehicle(value: unknown): value is Vehicle {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.license_plate === 'string' &&
    isFiniteNumber(value.capacity_kg) &&
    typeof value.vehicle_type === 'string' &&
    (typeof value.driver_name === 'string' || value.driver_name === null) &&
    (typeof value.driver_id === 'string' || value.driver_id === null) &&
    VEHICLE_STATUSES.includes(value.status as VehicleStatus) &&
    (typeof value.service_area === 'string' || value.service_area === null) &&
    (typeof value.assignment_note === 'string' || value.assignment_note === null)
  );
}

export function isOrderList(value: unknown): value is Order[] {
  return Array.isArray(value) && value.every(isOrder);
}

export function isVehicleList(value: unknown): value is Vehicle[] {
  return Array.isArray(value) && value.every(isVehicle);
}

function isAvailableDriver(value: unknown): value is AvailableDriver {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.driver_id === 'string'
    && typeof value.full_name === 'string'
    && (typeof value.phone_number === 'string' || value.phone_number === null)
    && typeof value.vehicle_id === 'string'
    && typeof value.license_plate === 'string'
    && typeof value.vehicle_type === 'string'
    && isFiniteNumber(value.capacity_kg)
    && (typeof value.service_area === 'string' || value.service_area === null)
    && value.readiness === 'READY'
  );
}

export function isAvailableDriverList(value: unknown): value is AvailableDriver[] {
  return Array.isArray(value) && value.every(isAvailableDriver);
}

export function getApiErrorMessage(payload: unknown, status: number): string {
  if (
    isRecord(payload) &&
    typeof payload.detail === 'string' &&
    payload.detail.trim()
  ) {
    return payload.detail;
  }

  if (
    isRecord(payload)
    && isRecord(payload.detail)
    && typeof payload.detail.message === 'string'
    && payload.detail.message.trim()
  ) {
    return payload.detail.message;
  }

  return `Yêu cầu thất bại (HTTP ${status}).`;
}

export async function requestApi(
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const response = await apiFetch(path, init);
  const payload: unknown = response.status === 204
    ? null
    : await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getApiErrorMessage(payload, response.status));
  }

  return payload;
}
