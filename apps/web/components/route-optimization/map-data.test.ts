import { describe, expect, it } from 'vitest';

import { buildRoutePositions } from './map-data';
import type { OptimizationResult } from './types';

const result: OptimizationResult = {
  status: 'OPTIMAL',
  depot: {
    id: 'depot-1',
    name: 'Kho Quận 12',
    address: 'Quận 12, TP.HCM',
    latitude: 10.8632,
    longitude: 106.6535,
  },
  total_distance_km: 20,
  total_duration_mins: 60,
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
          address: 'Bình Tân',
          latitude: 10.765,
          longitude: 106.603,
        },
        {
          stop_sequence: 1,
          order_id: 'order-1',
          address: 'Gò Vấp',
          latitude: 10.838,
          longitude: 106.665,
        },
      ],
    },
  ],
};

describe('buildRoutePositions', () => {
  it('returns depot, ordered stops, and depot again', () => {
    expect(buildRoutePositions(result.depot, result.routes[0].stops)).toEqual([
      [10.8632, 106.6535],
      [10.838, 106.665],
      [10.765, 106.603],
      [10.8632, 106.6535],
    ]);
  });
});
