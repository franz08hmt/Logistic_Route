import { describe, expect, it } from 'vitest';

import { isDriverDetailList } from './driver-detail-contracts';

describe('driver detail contract', () => {
  const driver = {
    id: 'driver-1',
    full_name: 'Nguyen Van Tai',
    email: 'driver@logiroute.vn',
    phone_number: '0901234567',
    status: 'ACTIVE',
    created_at: '2026-07-29T01:00:00Z',
    vehicle_id: 'vehicle-1',
    license_plate: '51D-12003',
    vehicle_type: 'TRUCK',
    vehicle_status: 'IDLE',
    capacity_kg: 1200,
    service_area: 'Tay Bac TP.HCM',
    active_orders_count: 0,
    delivered_today_count: 4,
    failed_today_count: 1,
  };

  it('accepts a complete driver list', () => {
    expect(isDriverDetailList([driver])).toBe(true);
  });

  it('accepts an unassigned driver with nullable vehicle fields', () => {
    expect(isDriverDetailList([
      {
        ...driver,
        vehicle_id: null,
        license_plate: null,
        vehicle_type: null,
        vehicle_status: null,
        capacity_kg: null,
        service_area: null,
      },
    ])).toBe(true);
  });

  it('rejects negative performance counters', () => {
    expect(isDriverDetailList([
      { ...driver, active_orders_count: -1 },
    ])).toBe(false);
  });
});
