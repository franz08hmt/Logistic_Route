import { describe, expect, it } from 'vitest';

import {
  getApiErrorMessage,
  isOrderList,
  isVehicleList,
} from './api-contracts';

describe('admin API contracts', () => {
  it('accepts a valid order list and rejects malformed coordinates', () => {
    const order = {
      id: 'order-1',
      depot_id: null,
      order_code: 'LR-001',
      tracking_token: 'a'.repeat(43),
      customer_name: 'Nguyen Van A',
      customer_phone: null,
      address: 'Quan 1, TP.HCM',
      latitude: 10.7769,
      longitude: 106.7009,
      weight_kg: 25,
      status: 'PENDING',
      assigned_vehicle_id: null,
      route_batch_id: null,
      stop_sequence: null,
      delivery_note: null,
      failure_reason: null,
      pod_url: null,
      pod_uploaded_at: null,
      signature_url: null,
      signature_uploaded_at: null,
      recipient_name: null,
      delivery_region: null,
    };

    expect(isOrderList([order])).toBe(true);
    expect(isOrderList([{ ...order, latitude: '10.7769' }])).toBe(false);
    expect(isOrderList([{ ...order, pod_uploaded_at: 123 }])).toBe(false);
    expect(isOrderList([{ ...order, pod_uploaded_at: 'not-a-date' }])).toBe(false);
    expect(isOrderList([{ ...order, signature_uploaded_at: 123 }])).toBe(false);
    const { signature_url: _signatureUrl, ...missingSignatureUrl } = order;
    expect(isOrderList([missingSignatureUrl])).toBe(false);
  });

  it('accepts vehicle status values defined by the backend contract', () => {
    const vehicle = {
      id: 'vehicle-1',
      depot_id: null,
      license_plate: '51D-12002',
      capacity_kg: 750,
      driver_name: 'Tran Minh Khoa',
      driver_id: null,
      vehicle_type: 'TRUCK',
      service_area: null,
      assignment_note: null,
      status: 'IDLE',
    };

    expect(isVehicleList([vehicle])).toBe(true);
    expect(isVehicleList([{ ...vehicle, status: 'MAINTENANCE' }])).toBe(false);
  });

  it('distinguishes available vehicles from assigned vehicles', () => {
    const vehicle = {
      id: 'vehicle-1',
      depot_id: null,
      license_plate: '51D-12002',
      capacity_kg: 750,
      driver_name: null,
      driver_id: null,
      vehicle_type: 'TRUCK',
      service_area: null,
      assignment_note: null,
      status: 'IDLE',
    };

    expect(isVehicleList([vehicle])).toBe(true);
    expect(isVehicleList([{ ...vehicle, driver_id: 'driver-1' }])).toBe(true);
  });

  it('extracts FastAPI detail messages and falls back safely', () => {
    expect(getApiErrorMessage({ detail: 'Order code already exists' }, 409))
      .toBe('Order code already exists');
    expect(getApiErrorMessage({
      detail: {
        code: 'VEHICLE_CAPACITY_EXCEEDED',
        message: 'Order weight exceeds the selected vehicle capacity',
      },
    }, 409)).toBe('Order weight exceeds the selected vehicle capacity');
    expect(getApiErrorMessage({ unexpected: true }, 500))
      .toBe('Yêu cầu thất bại (HTTP 500).');
  });
});
