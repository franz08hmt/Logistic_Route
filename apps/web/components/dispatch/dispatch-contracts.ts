import { apiFetch } from '../../lib/api-client';
import type {
  OptimizationResult,
  RouteCostMetrics,
} from '../route-optimization/types';
import { isOptimizationResult } from '../route-optimization/types';
import type { RouteReorderPayload } from '../route-optimization/manual-route-editor';

export type MultiStopDispatchInput = {
  order_ids: string[];
  driver_id: string;
  force_region_mismatch?: boolean;
};

export type MultiStopDispatchStop = {
  order_id: string;
  order_code: string;
  stop_sequence: number;
  customer_name: string;
  address: string;
  latitude: number;
  longitude: number;
  weight_kg: number;
};

export type MultiStopDispatchResult = {
  status: string;
  route_batch_id: string;
  driver_id: string;
  driver_name: string;
  vehicle_id: string;
  license_plate: string;
  depot: {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  total_distance_km: number;
  total_duration_mins: number;
  total_weight_kg: number;
  cost_metrics: RouteCostMetrics;
  stops: MultiStopDispatchStop[];
};

type ApiErrorDetail = {
  code?: string;
  message?: string;
  driver_name?: string;
  driver_region?: string;
  delivery_regions?: string[];
};

export class DispatchApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail: ApiErrorDetail | null,
  ) {
    super(message);
    this.name = 'DispatchApiError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isDispatchStop(value: unknown): value is MultiStopDispatchStop {
  return (
    isRecord(value)
    && typeof value.order_id === 'string'
    && typeof value.order_code === 'string'
    && Number.isInteger(value.stop_sequence)
    && (value.stop_sequence as number) >= 1
    && typeof value.customer_name === 'string'
    && typeof value.address === 'string'
    && isFiniteNumber(value.latitude)
    && isFiniteNumber(value.longitude)
    && isFiniteNumber(value.weight_kg)
  );
}

function isDepot(value: unknown): value is MultiStopDispatchResult['depot'] {
  return (
    isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.address === 'string'
    && isFiniteNumber(value.latitude)
    && isFiniteNumber(value.longitude)
  );
}

function isCostMetrics(value: unknown): value is RouteCostMetrics {
  return (
    isRecord(value)
    && isFiniteNumber(value.fuel_cost_vnd)
    && value.fuel_cost_vnd >= 0
    && isFiniteNumber(value.driver_cost_vnd)
    && value.driver_cost_vnd >= 0
    && isFiniteNumber(value.total_cost_vnd)
    && value.total_cost_vnd >= 0
    && isFiniteNumber(value.co2_emissions_kg)
    && value.co2_emissions_kg >= 0
    && isFiniteNumber(value.estimated_savings_vnd)
    && value.estimated_savings_vnd >= 0
    && isFiniteNumber(value.estimated_co2_savings_kg)
    && value.estimated_co2_savings_kg >= 0
    && isFiniteNumber(value.savings_rate)
    && value.savings_rate >= 0
    && value.savings_rate <= 1
  );
}

export function isMultiStopDispatchResult(
  value: unknown,
): value is MultiStopDispatchResult {
  return (
    isRecord(value)
    && typeof value.status === 'string'
    && typeof value.route_batch_id === 'string'
    && typeof value.driver_id === 'string'
    && typeof value.driver_name === 'string'
    && typeof value.vehicle_id === 'string'
    && typeof value.license_plate === 'string'
    && isDepot(value.depot)
    && isFiniteNumber(value.total_distance_km)
    && isFiniteNumber(value.total_duration_mins)
    && isFiniteNumber(value.total_weight_kg)
    && isCostMetrics(value.cost_metrics)
    && Array.isArray(value.stops)
    && value.stops.every(isDispatchStop)
  );
}

export function toOptimizationResult(
  result: MultiStopDispatchResult,
): OptimizationResult {
  return {
    status: result.status,
    route_batch_id: result.route_batch_id,
    depot: result.depot,
    total_distance_km: result.total_distance_km,
    total_duration_mins: result.total_duration_mins,
    cost_metrics: result.cost_metrics,
    unassigned_orders: [],
    routes: [
      {
        vehicle_id: result.vehicle_id,
        license_plate: result.license_plate,
        total_weight_kg: result.total_weight_kg,
        distance_km: result.total_distance_km,
        stops: result.stops.map((stop) => ({
          stop_sequence: stop.stop_sequence,
          order_id: stop.order_id,
          address: stop.address,
          latitude: stop.latitude,
          longitude: stop.longitude,
        })),
      },
    ],
  };
}

function parseErrorDetail(payload: unknown): ApiErrorDetail | null {
  if (!isRecord(payload) || !isRecord(payload.detail)) {
    return null;
  }
  const detail = payload.detail;
  return {
    code: typeof detail.code === 'string' ? detail.code : undefined,
    message: typeof detail.message === 'string' ? detail.message : undefined,
    driver_name: typeof detail.driver_name === 'string' ? detail.driver_name : undefined,
    driver_region: typeof detail.driver_region === 'string' ? detail.driver_region : undefined,
    delivery_regions: Array.isArray(detail.delivery_regions)
      ? detail.delivery_regions.filter((item): item is string => typeof item === 'string')
      : undefined,
  };
}

export async function requestMultiStopDispatch(
  input: MultiStopDispatchInput,
): Promise<MultiStopDispatchResult> {
  const response = await apiFetch('/api/v1/routes/dispatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = parseErrorDetail(payload);
    const fallback = isRecord(payload) && typeof payload.detail === 'string'
      ? payload.detail
      : `Dispatch request failed (HTTP ${response.status})`;
    throw new DispatchApiError(detail?.message ?? fallback, response.status, detail);
  }
  if (!isMultiStopDispatchResult(payload)) {
    throw new DispatchApiError('Invalid multi-stop dispatch response', 502, null);
  }
  return payload;
}

async function requestOptimizationResult(
  path: string,
  body?: RouteReorderPayload,
): Promise<OptimizationResult> {
  const response = await apiFetch(path, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload.detail === 'string'
      ? payload.detail
      : `Route request failed (HTTP ${response.status})`;
    throw new DispatchApiError(message, response.status, null);
  }
  if (!isOptimizationResult(payload)) {
    throw new DispatchApiError('Invalid route optimization response', 502, null);
  }
  return payload;
}

export function requestFleetOptimization(): Promise<OptimizationResult> {
  return requestOptimizationResult('/api/v1/routes/optimize');
}

export function requestRouteReorder(
  payload: RouteReorderPayload,
): Promise<OptimizationResult> {
  return requestOptimizationResult('/api/v1/routes/reorder', payload);
}
