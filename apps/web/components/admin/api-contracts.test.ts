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
      order_code: 'LR-001',
      customer_name: 'Nguyen Van A',
      customer_phone: null,
      address: 'Quan 1, TP.HCM',
      latitude: 10.7769,
      longitude: 106.7009,
      weight_kg: 25,
      status: 'PENDING',
      assigned_vehicle_id: null,
      stop_sequence: null,
      delivery_note: null,
      failure_reason: null,
      pod_url: null,
    };

    expect(isOrderList([order])).toBe(true);
    expect(isOrderList([{ ...order, latitude: '10.7769' }])).toBe(false);
  });

  it('accepts vehicle status values defined by the backend contract', () => {
    const vehicle = {
      id: 'vehicle-1',
      license_plate: '51D-12002',
      capacity_kg: 750,
      driver_name: 'Tran Minh Khoa',
      status: 'IDLE',
    };

    expect(isVehicleList([vehicle])).toBe(true);
    expect(isVehicleList([{ ...vehicle, status: 'MAINTENANCE' }])).toBe(false);
  });

  it('extracts FastAPI detail messages and falls back safely', () => {
    expect(getApiErrorMessage({ detail: 'Order code already exists' }, 409))
      .toBe('Order code already exists');
    expect(getApiErrorMessage({ unexpected: true }, 500))
      .toBe('Yêu cầu thất bại (HTTP 500).');
  });
});
