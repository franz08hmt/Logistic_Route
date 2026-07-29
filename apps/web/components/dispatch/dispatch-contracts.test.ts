import { describe, expect, it } from 'vitest';

import { isMultiStopDispatchResult } from './dispatch-contracts';

describe('multi-stop dispatch contract', () => {
  const result = {
    status: 'OPTIMAL',
    route_batch_id: 'batch-1',
    driver_id: 'driver-1',
    driver_name: 'Nguyen Van Tai',
    vehicle_id: 'vehicle-1',
    license_plate: '51D-12003',
    depot: {
      id: 'depot-1',
      name: 'Kho Quan 12',
      address: 'Quan 12, Ho Chi Minh City',
      latitude: 10.8632,
      longitude: 106.6535,
    },
    total_distance_km: 21.5,
    total_duration_mins: 64.5,
    total_weight_kg: 30,
    cost_metrics: {
      fuel_cost_vnd: 60630,
      driver_cost_vnd: 161250,
      total_cost_vnd: 221880,
      co2_emissions_kg: 5.96,
      estimated_savings_vnd: 39938.4,
      estimated_co2_savings_kg: 1.07,
      savings_rate: 0.18,
    },
    stops: [
      {
        order_id: 'order-2',
        order_code: 'LR-002',
        stop_sequence: 1,
        customer_name: 'Customer Two',
        address: 'Quan 3',
        latitude: 10.78,
        longitude: 106.68,
        weight_kg: 20,
      },
    ],
  };

  it('accepts a typed optimized route response', () => {
    expect(isMultiStopDispatchResult(result)).toBe(true);
  });

  it('rejects invalid stop ordering', () => {
    expect(isMultiStopDispatchResult({
      ...result,
      stops: [{ ...result.stops[0], stop_sequence: 0 }],
    })).toBe(false);
  });

  it('rejects a response that cannot render route cost metrics', () => {
    const { cost_metrics: _costMetrics, ...withoutCostMetrics } = result;
    expect(isMultiStopDispatchResult(withoutCostMetrics)).toBe(false);
  });
});
