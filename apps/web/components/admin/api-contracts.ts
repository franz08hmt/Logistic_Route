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
};

export type CreateOrderInput = {
  order_code: string;
  customer_name: string;
  customer_phone?: string | null;
  address: string;
  latitude: number;
  longitude: number;
  weight_kg: number;
};

export type Vehicle = {
  id: string;
  license_plate: string;
  capacity_kg: number;
  driver_name: string | null;
  status: VehicleStatus;
};

export type CreateVehicleInput = Omit<Vehicle, 'id' | 'status'>;

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
    (typeof value.pod_url === 'string' || value.pod_url === null)
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
    (typeof value.driver_name === 'string' || value.driver_name === null) &&
    VEHICLE_STATUSES.includes(value.status as VehicleStatus)
  );
}

export function isOrderList(value: unknown): value is Order[] {
  return Array.isArray(value) && value.every(isOrder);
}

export function isVehicleList(value: unknown): value is Vehicle[] {
  return Array.isArray(value) && value.every(isVehicle);
}

export function getApiErrorMessage(payload: unknown, status: number): string {
  if (
    isRecord(payload) &&
    typeof payload.detail === 'string' &&
    payload.detail.trim()
  ) {
    return payload.detail;
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
