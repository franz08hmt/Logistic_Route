import { describe, expect, it } from 'vitest';

import {
  isScenarioLoadResponse,
  SCENARIO_TYPES,
} from './demo-contracts';


describe('demo scenario contracts', () => {
  it('accepts a complete scenario load response', () => {
    expect(isScenarioLoadResponse({
      scenario_name: 'HCMC_PEAK_DAY',
      depot_name: 'Hub Miền Nam - Kho Quận 12',
      vehicles_loaded: 3,
      orders_loaded: 12,
      delivered_orders: 4,
      active_telemetry_vehicles: 2,
      message: 'Demo logistics scenario loaded successfully.',
    })).toBe(true);
  });

  it('rejects unknown scenarios and invalid counters', () => {
    expect(isScenarioLoadResponse({
      scenario_name: 'UNKNOWN',
      depot_name: 'Unknown',
      vehicles_loaded: 3,
      orders_loaded: -1,
      delivered_orders: 4,
      active_telemetry_vehicles: 2,
      message: 'bad',
    })).toBe(false);
    expect(SCENARIO_TYPES).toEqual([
      'HCMC_PEAK_DAY',
      'HANOI_EXPRESS',
      'MULTI_REGION',
    ]);
  });
});
