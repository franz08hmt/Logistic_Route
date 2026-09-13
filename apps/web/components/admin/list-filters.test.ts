import { describe, expect, it } from 'vitest';

import type { Order, Vehicle } from './api-contracts';
import { filterOrders, filterVehicles } from './list-filters';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'a1',
    depot_id: null,
    order_code: 'DH-2024-001',
    tracking_token: 'tok',
    customer_name: 'Nguyễn Thị Hồng',
    customer_phone: '0912345678',
    address: '25 Nguyễn Huệ, Quận 1, TP.HCM',
    latitude: 10.7743,
    longitude: 106.7038,
    weight_kg: 12,
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
    cod_amount: 450000,
    payment_method: 'COD_CASH',
    cod_status: 'PENDING',
    cod_collected_at: null,
    cod_reconciled_at: null,
    cod_receipt_note: null,
    shift_settlement_id: null,
    ...overrides,
  };
}

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v1',
    depot_id: null,
    license_plate: '51D-123.45',
    capacity_kg: 800,
    vehicle_type: 'Xe tải nhẹ',
    driver_name: 'Trần Minh Khoa',
    driver_id: null,
    status: 'IDLE',
    service_area: null,
    assignment_note: null,
    ...overrides,
  };
}

const NO_ORDER_FILTER = { search: '', status: '', paymentMethod: '' } as const;
const NO_VEHICLE_FILTER = { search: '', status: '', hasDriver: '' } as const;

describe('filterOrders', () => {
  const orders = [
    makeOrder(),
    makeOrder({
      id: 'a2',
      order_code: 'DH-2024-002',
      customer_name: 'Lê Văn Sơn',
      customer_phone: null,
      address: '148 Giảng Võ, Ba Đình, Hà Nội',
      status: 'DELIVERED',
      payment_method: 'VIETQR',
    }),
  ];

  it('returns every order when no filter is set', () => {
    expect(filterOrders(orders, NO_ORDER_FILTER)).toHaveLength(2);
  });

  it('matches the order code regardless of case or padding', () => {
    expect(
      filterOrders(orders, { ...NO_ORDER_FILTER, search: '  dh-2024-002 ' }),
    ).toEqual([orders[1]]);
  });

  it('searches the customer name, phone and address', () => {
    expect(filterOrders(orders, { ...NO_ORDER_FILTER, search: 'Hồng' })).toEqual([orders[0]]);
    expect(filterOrders(orders, { ...NO_ORDER_FILTER, search: '0912' })).toEqual([orders[0]]);
    expect(filterOrders(orders, { ...NO_ORDER_FILTER, search: 'Ba Đình' })).toEqual([orders[1]]);
  });

  it('does not throw on an order with no phone number', () => {
    expect(filterOrders([orders[1]], { ...NO_ORDER_FILTER, search: '09' })).toEqual([]);
  });

  it('narrows by status and by payment method together', () => {
    expect(
      filterOrders(orders, { search: '', status: 'DELIVERED', paymentMethod: 'VIETQR' }),
    ).toEqual([orders[1]]);
    expect(
      filterOrders(orders, { search: '', status: 'DELIVERED', paymentMethod: 'COD_CASH' }),
    ).toEqual([]);
  });
});

describe('filterVehicles', () => {
  const vehicles = [
    makeVehicle(),
    makeVehicle({
      id: 'v2',
      license_plate: '29C-678.90',
      driver_name: null,
      vehicle_type: 'Xe máy',
      status: 'ON_ROUTE',
    }),
  ];

  it('searches the plate, driver and vehicle type', () => {
    expect(filterVehicles(vehicles, { ...NO_VEHICLE_FILTER, search: '29c' })).toEqual([vehicles[1]]);
    expect(filterVehicles(vehicles, { ...NO_VEHICLE_FILTER, search: 'khoa' })).toEqual([vehicles[0]]);
    expect(filterVehicles(vehicles, { ...NO_VEHICLE_FILTER, search: 'Xe máy' })).toEqual([vehicles[1]]);
  });

  it('does not throw on a vehicle with no driver', () => {
    expect(filterVehicles([vehicles[1]], { ...NO_VEHICLE_FILTER, search: 'trần' })).toEqual([]);
  });

  it('separates assigned from unassigned vehicles', () => {
    expect(filterVehicles(vehicles, { ...NO_VEHICLE_FILTER, hasDriver: 'true' })).toEqual([vehicles[0]]);
    expect(filterVehicles(vehicles, { ...NO_VEHICLE_FILTER, hasDriver: 'false' })).toEqual([vehicles[1]]);
  });

  it('narrows by status', () => {
    expect(filterVehicles(vehicles, { ...NO_VEHICLE_FILTER, status: 'ON_ROUTE' })).toEqual([vehicles[1]]);
  });
});
