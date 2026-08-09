import { describe, expect, it } from 'vitest';

import { isDriverPerformanceResponse } from './driver-performance-contracts';

const response = {
  period_days: 30,
  total_co2_saved_all_kg: 18.75,
  drivers: [
    {
      driver_id: 'driver-1',
      driver_name: 'Nguyen Van Minh',
      email: 'minh@logiroute.vn',
      phone_number: '0901234567',
      license_plate: '51D-12001',
      vehicle_type: 'TRUCK',
      total_orders_handled: 12,
      delivered_count: 11,
      failed_count: 1,
      success_rate: 91.67,
      route_adherence_score: 98,
      total_distance_km: 352.4,
      estimated_co2_saved_kg: 8.23,
      overall_score: 83.47,
      tier_badge: 'SILVER',
      is_eco_driver: true,
      rank: 1,
    },
  ],
};

describe('driver performance API contract', () => {
  it('accepts a complete leaderboard response', () => {
    expect(isDriverPerformanceResponse(response)).toBe(true);
  });

  it('rejects invalid scores, ranks and tier badges', () => {
    expect(isDriverPerformanceResponse({
      ...response,
      drivers: [{ ...response.drivers[0], overall_score: 101 }],
    })).toBe(false);
    expect(isDriverPerformanceResponse({
      ...response,
      drivers: [{ ...response.drivers[0], rank: 0 }],
    })).toBe(false);
    expect(isDriverPerformanceResponse({
      ...response,
      drivers: [{ ...response.drivers[0], tier_badge: 'PLATINUM' }],
    })).toBe(false);
  });

  it('rejects inconsistent handled-order totals', () => {
    expect(isDriverPerformanceResponse({
      ...response,
      drivers: [{ ...response.drivers[0], total_orders_handled: 99 }],
    })).toBe(false);
  });
});
