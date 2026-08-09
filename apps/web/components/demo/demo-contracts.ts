import { requestApi } from '../admin/api-contracts';

export const SCENARIO_TYPES = [
  'HCMC_PEAK_DAY',
  'HANOI_EXPRESS',
  'MULTI_REGION',
] as const;

export type ScenarioType = (typeof SCENARIO_TYPES)[number];

export type ScenarioLoadResponse = {
  scenario_name: ScenarioType;
  depot_name: string;
  vehicles_loaded: number;
  orders_loaded: number;
  delivered_orders: number;
  active_telemetry_vehicles: number;
  message: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === 'number' && value >= 0;
}

export function isScenarioLoadResponse(
  value: unknown,
): value is ScenarioLoadResponse {
  if (!isRecord(value)) {
    return false;
  }

  return (
    SCENARIO_TYPES.includes(value.scenario_name as ScenarioType)
    && typeof value.depot_name === 'string'
    && value.depot_name.trim().length > 0
    && isNonNegativeInteger(value.vehicles_loaded)
    && isNonNegativeInteger(value.orders_loaded)
    && isNonNegativeInteger(value.delivered_orders)
    && isNonNegativeInteger(value.active_telemetry_vehicles)
    && typeof value.message === 'string'
  );
}

export async function loadDemoScenario(
  scenarioType: ScenarioType = 'HCMC_PEAK_DAY',
): Promise<ScenarioLoadResponse> {
  const payload = await requestApi(
    `/api/v1/seed/scenario?scenario_type=${encodeURIComponent(scenarioType)}`,
    { method: 'POST' },
  );
  if (!isScenarioLoadResponse(payload)) {
    throw new Error('INVALID_SCENARIO_RESPONSE');
  }
  return payload;
}
