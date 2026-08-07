import { apiFetch } from '../../lib/api-client';

export type VehicleStatus = 'IDLE' | 'ON_ROUTE';
export type RouteDeviationStatus = 'ON_ROUTE' | 'OFF_ROUTE_WARNING' | 'STOPPED';

export type VehicleTelemetryItem = {
  vehicle_id: string;
  license_plate: string;
  driver_name: string | null;
  status: VehicleStatus;
  current_latitude: number | null;
  current_longitude: number | null;
  speed_kmh: number | null;
  last_gps_ping_at: string | null;
  route_deviation_status: RouteDeviationStatus | null;
  next_stop_address: string | null;
  next_stop_sequence: number | null;
};

export type VehicleTelemetryResponse = {
  generated_at: string;
  vehicles: VehicleTelemetryItem[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isTelemetryItem(value: unknown): value is VehicleTelemetryItem {
  if (!isRecord(value)) return false;
  const latitudeValid = isNullableFiniteNumber(value.current_latitude)
    && (value.current_latitude === null
      || (value.current_latitude >= -90 && value.current_latitude <= 90));
  const longitudeValid = isNullableFiniteNumber(value.current_longitude)
    && (value.current_longitude === null
      || (value.current_longitude >= -180 && value.current_longitude <= 180));
  const speedValid = isNullableFiniteNumber(value.speed_kmh)
    && (value.speed_kmh === null || value.speed_kmh >= 0);
  const sequenceValid = value.next_stop_sequence === null
    || (Number.isInteger(value.next_stop_sequence) && Number(value.next_stop_sequence) >= 1);
  const deviationValid = value.route_deviation_status === null
    || value.route_deviation_status === 'ON_ROUTE'
    || value.route_deviation_status === 'OFF_ROUTE_WARNING'
    || value.route_deviation_status === 'STOPPED';

  return (
    typeof value.vehicle_id === 'string'
    && typeof value.license_plate === 'string'
    && isNullableString(value.driver_name)
    && (value.status === 'IDLE' || value.status === 'ON_ROUTE')
    && latitudeValid
    && longitudeValid
    && speedValid
    && isNullableString(value.last_gps_ping_at)
    && deviationValid
    && isNullableString(value.next_stop_address)
    && sequenceValid
  );
}

export function isVehicleTelemetryResponse(
  value: unknown,
): value is VehicleTelemetryResponse {
  return (
    isRecord(value)
    && typeof value.generated_at === 'string'
    && !Number.isNaN(Date.parse(value.generated_at))
    && Array.isArray(value.vehicles)
    && value.vehicles.every(isTelemetryItem)
  );
}

export function hasTelemetryCoordinates(
  vehicle: VehicleTelemetryItem,
): vehicle is VehicleTelemetryItem & {
  current_latitude: number;
  current_longitude: number;
} {
  return (
    typeof vehicle.current_latitude === 'number'
    && Number.isFinite(vehicle.current_latitude)
    && typeof vehicle.current_longitude === 'number'
    && Number.isFinite(vehicle.current_longitude)
  );
}

export function summarizeTelemetry(vehicles: VehicleTelemetryItem[]) {
  return {
    activeVehicles: vehicles.filter((vehicle) => vehicle.status === 'ON_ROUTE').length,
    offRouteVehicles: vehicles.filter(
      (vehicle) => vehicle.route_deviation_status === 'OFF_ROUTE_WARNING',
    ).length,
  };
}

export async function requestVehicleTelemetry(
  signal?: AbortSignal,
): Promise<VehicleTelemetryResponse> {
  const response = await apiFetch('/api/v1/admin/telemetry', { signal });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = isRecord(payload) && typeof payload.detail === 'string'
      ? payload.detail
      : `Telemetry request failed (HTTP ${response.status})`;
    throw new Error(detail);
  }
  if (!isVehicleTelemetryResponse(payload)) {
    throw new Error('Invalid telemetry response');
  }
  return payload;
}
