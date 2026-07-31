import { describe, expect, it } from 'vitest';

import { isPublicTrackingResponse } from './tracking-contracts';

const response = {
  order: {
    order_code: 'CC-HCM-98',
    customer_name_masked: 'Nguyễn V. A',
    customer_phone_masked: '091****678',
    address: '123 Nguyễn Huệ, Quận 1, TP.HCM',
    latitude: 10.7769,
    longitude: 106.7009,
    status: 'DELIVERING',
    status_updated_at: '2026-07-31T10:00:00Z',
    delivery_note: null,
    failure_reason: null,
  },
  depot: {
    id: 'depot-1',
    name: 'Kho Quận 12',
    address: 'Quận 12, TP.HCM',
    latitude: 10.8632,
    longitude: 106.6535,
  },
  driver: {
    driver_name: 'Huynh Tai',
    driver_phone: '090****567',
    license_plate: '51D-12003',
    vehicle_type: 'TRUCK',
  },
  stops_remaining_before: 1,
  route_batch_id: 'batch-1',
  estimated_arrival_minutes: 30,
};

describe('isPublicTrackingResponse', () => {
  it('accepts the public tracking contract', () => {
    expect(isPublicTrackingResponse(response)).toBe(true);
  });

  it('rejects raw or malformed fields at the client boundary', () => {
    expect(isPublicTrackingResponse({ ...response, stops_remaining_before: -1 })).toBe(false);
    expect(isPublicTrackingResponse({
      ...response,
      order: { ...response.order, latitude: '10.7769' },
    })).toBe(false);
    expect(isPublicTrackingResponse({
      ...response,
      driver: { ...response.driver, driver_phone: 901234567 },
    })).toBe(false);
  });
});
