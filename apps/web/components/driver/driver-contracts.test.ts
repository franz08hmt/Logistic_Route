import { describe, expect, it } from 'vitest';

import { isDriverRoute } from './driver-contracts';

describe('driver API contracts', () => {
  const validRoute = {
    vehicle: {
      id: 'vehicle-1',
      license_plate: '51D-12001',
      vehicle_type: 'TRUCK',
      driver_name: 'LogiRoute Driver 1',
      status: 'ON_ROUTE',
    },
    depot: {
      id: 'depot-1',
      name: 'LogiRoute Depot Quan 12',
      address: 'Quan 12, Ho Chi Minh City',
      latitude: 10.8632,
      longitude: 106.6535,
    },
    total_orders: 2,
    completed_orders: 1,
    stops: [
      {
        id: 'order-1',
        order_code: 'LR-001',
        stop_sequence: 1,
        customer_name: 'Nguyen Van A',
        customer_phone: '0900000000',
        address: 'Quan 1, Ho Chi Minh City',
        latitude: 10.7769,
        longitude: 106.7009,
        weight_kg: 12.5,
        status: 'DELIVERED',
        delivery_note: 'Đã giao',
        failure_reason: null,
        pod_url: null,
        pod_uploaded_at: null,
        signature_url: null,
        signature_uploaded_at: null,
        recipient_name: null,
      },
    ],
  };

  it('accepts a valid driver route payload', () => {
    expect(isDriverRoute(validRoute)).toBe(true);
  });

  it('requires the signature metadata fields on every stop', () => {
    const { signature_url: _signatureUrl, ...withoutSignatureUrl } = validRoute.stops[0];
    expect(isDriverRoute({
      ...validRoute,
      stops: [withoutSignatureUrl],
    })).toBe(false);
  });

  it('rejects a route with an invalid stop status', () => {
    expect(isDriverRoute({
      ...validRoute,
      stops: [{ ...validRoute.stops[0], status: 'PENDING' }],
    })).toBe(false);
  });

  it('accepts a driver route waiting for vehicle assignment', () => {
    expect(isDriverRoute({
      ...validRoute,
      vehicle: null,
      depot: null,
      total_orders: 0,
      completed_orders: 0,
      stops: [],
    })).toBe(true);
  });
});
