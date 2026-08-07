import { describe, expect, it } from 'vitest';

import type { OptimizationResult } from './types';
import {
  buildRouteReorderPayload,
  hasRoutePlanChanged,
  moveRouteStop,
} from './manual-route-editor';

const baseResult: OptimizationResult = {
  status: 'OPTIMAL',
  route_batch_id: 'batch-1',
  depot: {
    id: 'depot-1',
    name: 'Depot',
    address: 'Quan 12',
    latitude: 10.8632,
    longitude: 106.6535,
  },
  total_distance_km: 20,
  total_duration_mins: 60,
  cost_metrics: {
    fuel_cost_vnd: 56_400,
    driver_cost_vnd: 150_000,
    total_cost_vnd: 206_400,
    co2_emissions_kg: 5.544,
    estimated_savings_vnd: 37_152,
    estimated_co2_savings_kg: 0.998,
    savings_rate: 0.18,
  },
  unassigned_orders: [],
  routes: [
    {
      vehicle_id: 'vehicle-1',
      license_plate: '51D-10001',
      total_weight_kg: 30,
      distance_km: 10,
      stops: [
        {
          order_id: 'order-1',
          stop_sequence: 1,
          address: 'Quan 1',
          latitude: 10.7769,
          longitude: 106.7009,
        },
        {
          order_id: 'order-2',
          stop_sequence: 2,
          address: 'Quan 3',
          latitude: 10.78,
          longitude: 106.68,
        },
      ],
    },
    {
      vehicle_id: 'vehicle-2',
      license_plate: '51D-10002',
      total_weight_kg: 20,
      distance_km: 10,
      stops: [
        {
          order_id: 'order-3',
          stop_sequence: 1,
          address: 'Go Vap',
          latitude: 10.8387,
          longitude: 106.6653,
        },
      ],
    },
  ],
};

const orderWeights = new Map([
  ['order-1', 10],
  ['order-2', 20],
  ['order-3', 20],
]);

describe('manual route editor', () => {
  it('reorders stops immutably and normalizes stop sequences', () => {
    const moved = moveRouteStop({
      result: baseResult,
      sourceVehicleId: 'vehicle-1',
      sourceIndex: 0,
      destinationVehicleId: 'vehicle-1',
      destinationIndex: 1,
      orderWeights,
      vehicleCapacities: new Map([
        ['vehicle-1', 100],
        ['vehicle-2', 100],
      ]),
    });

    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(baseResult.routes[0].stops.map((stop) => stop.order_id)).toEqual([
      'order-1',
      'order-2',
    ]);
    expect(moved.result.routes[0].stops.map((stop) => [stop.order_id, stop.stop_sequence])).toEqual([
      ['order-2', 1],
      ['order-1', 2],
    ]);
    expect(hasRoutePlanChanged(baseResult, moved.result)).toBe(true);
  });

  it('moves a stop across vehicles and updates load plus preview metrics', () => {
    const moved = moveRouteStop({
      result: baseResult,
      sourceVehicleId: 'vehicle-1',
      sourceIndex: 0,
      destinationVehicleId: 'vehicle-2',
      destinationIndex: 1,
      orderWeights,
      vehicleCapacities: new Map([
        ['vehicle-1', 100],
        ['vehicle-2', 100],
      ]),
    });

    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.result.routes[0].total_weight_kg).toBe(20);
    expect(moved.result.routes[1].total_weight_kg).toBe(30);
    expect(moved.result.total_distance_km).toBeGreaterThan(0);
    expect(moved.result.cost_metrics.total_cost_vnd).toBeGreaterThan(0);
  });

  it('rejects a cross-vehicle drop that exceeds capacity', () => {
    const moved = moveRouteStop({
      result: baseResult,
      sourceVehicleId: 'vehicle-1',
      sourceIndex: 1,
      destinationVehicleId: 'vehicle-2',
      destinationIndex: 1,
      orderWeights,
      vehicleCapacities: new Map([
        ['vehicle-1', 100],
        ['vehicle-2', 30],
      ]),
    });

    expect(moved).toEqual({
      ok: false,
      reason: 'CAPACITY_EXCEEDED',
      vehicleId: 'vehicle-2',
      capacityKg: 30,
      attemptedWeightKg: 40,
    });
  });

  it('builds the server payload from the edited order', () => {
    expect(buildRouteReorderPayload(baseResult)).toEqual({
      route_batch_id: 'batch-1',
      routes: [
        {
          vehicle_id: 'vehicle-1',
          stops: [
            { order_id: 'order-1', stop_sequence: 1 },
            { order_id: 'order-2', stop_sequence: 2 },
          ],
        },
        {
          vehicle_id: 'vehicle-2',
          stops: [{ order_id: 'order-3', stop_sequence: 1 }],
        },
      ],
    });
  });
});
