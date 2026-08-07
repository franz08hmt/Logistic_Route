import { describe, expect, it } from 'vitest';

import type { Order } from '../admin/api-contracts';
import { buildManifestCsv } from './manifest-export';
import { isOptimizationResult, type OptimizationResult } from './types';

const result: OptimizationResult = {
  status: 'OPTIMAL',
  route_batch_id: 'batch-1',
  depot: {
    id: 'depot-1',
    name: 'LogiRoute Depot',
    address: 'Quan 12, Ho Chi Minh City',
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
      license_plate: '51D-12002',
      total_weight_kg: 30,
      distance_km: 20,
      stops: [
        {
          stop_sequence: 2,
          order_id: 'order-2',
          address: 'Binh Tan',
          latitude: 10.765,
          longitude: 106.603,
        },
        {
          stop_sequence: 1,
          order_id: 'order-1',
          address: '=HYPERLINK("https://unsafe.example")',
          latitude: 10.838,
          longitude: 106.665,
        },
      ],
    },
  ],
};

const orders: Order[] = [
  {
    id: 'order-1',
    order_code: 'LR-001',
    tracking_token: 'a'.repeat(43),
    customer_name: '=Injected formula',
    customer_phone: '0901000001',
    address: '=HYPERLINK("https://unsafe.example")',
    latitude: 10.838,
    longitude: 106.665,
    weight_kg: 10,
    status: 'ASSIGNED',
    assigned_vehicle_id: 'vehicle-1',
    route_batch_id: 'batch-1',
    stop_sequence: 1,
    delivery_note: null,
    failure_reason: null,
    pod_url: null,
    pod_uploaded_at: null,
    delivery_region: null,
  },
  {
    id: 'order-2',
    order_code: 'LR-002',
    tracking_token: 'b'.repeat(43),
    customer_name: 'Customer Two',
    customer_phone: null,
    address: 'Binh Tan',
    latitude: 10.765,
    longitude: 106.603,
    weight_kg: 20,
    status: 'ASSIGNED',
    assigned_vehicle_id: 'vehicle-1',
    route_batch_id: 'batch-1',
    stop_sequence: 2,
    delivery_note: null,
    failure_reason: null,
    pod_url: null,
    pod_uploaded_at: null,
    delivery_region: null,
  },
];

describe('buildManifestCsv', () => {
  it('uses a response contract that requires complete cost metrics', () => {
    expect(isOptimizationResult(result)).toBe(true);
    expect(
      isOptimizationResult({ ...result, cost_metrics: undefined }),
    ).toBe(false);
  });

  it('exports stops in delivery order with an Excel-compatible UTF-8 BOM', () => {
    const csv = buildManifestCsv(result, orders);

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.indexOf('LR-001')).toBeLessThan(csv.indexOf('LR-002'));
    expect(csv).toContain('51D-12002');
    expect(csv).toContain('206400');
  });

  it('neutralizes spreadsheet formulas from database values', () => {
    const csv = buildManifestCsv(result, orders);

    expect(csv).toContain("'=Injected formula");
    expect(csv).toContain("'=HYPERLINK(");
  });
});
