import { describe, expect, it } from 'vitest';

import {
  hasTelemetryCoordinates,
  isVehicleTelemetryResponse,
  summarizeTelemetry,
  type VehicleTelemetryResponse,
} from './telemetry-contracts';

const validResponse: VehicleTelemetryResponse = {
  generated_at: '2026-08-07T10:00:00Z',
  vehicles: [
    {
      vehicle_id: 'vehicle-1',
      license_plate: '51D-12001',
      driver_name: 'Tai Huynh',
      status: 'ON_ROUTE',
      current_latitude: 10.84,
      current_longitude: 106.67,
      speed_kmh: 28,
      last_gps_ping_at: '2026-08-07T09:59:58Z',
      route_deviation_status: 'ON_ROUTE',
      next_stop_address: 'Quan 1, TP.HCM',
      next_stop_sequence: 2,
    },
    {
      vehicle_id: 'vehicle-2',
      license_plate: '51D-12002',
      driver_name: null,
      status: 'ON_ROUTE',
      current_latitude: 10.9,
      current_longitude: 106.8,
      speed_kmh: 35,
      last_gps_ping_at: '2026-08-07T09:59:55Z',
      route_deviation_status: 'OFF_ROUTE_WARNING',
      next_stop_address: null,
      next_stop_sequence: null,
    },
  ],
};

describe('telemetry contracts', () => {
  it('accepts a valid telemetry response and summarizes active alerts', () => {
    expect(isVehicleTelemetryResponse(validResponse)).toBe(true);
    expect(summarizeTelemetry(validResponse.vehicles)).toEqual({
      activeVehicles: 2,
      offRouteVehicles: 1,
    });
  });

  it('rejects invalid coordinates and unknown deviation states', () => {
    expect(isVehicleTelemetryResponse({
      ...validResponse,
      vehicles: [{
        ...validResponse.vehicles[0],
        current_latitude: 999,
      }],
    })).toBe(false);
    expect(isVehicleTelemetryResponse({
      ...validResponse,
      vehicles: [{
        ...validResponse.vehicles[0],
        route_deviation_status: 'LOST',
      }],
    })).toBe(false);
  });

  it('hides vehicles without a complete GPS coordinate pair', () => {
    expect(hasTelemetryCoordinates(validResponse.vehicles[0])).toBe(true);
    expect(hasTelemetryCoordinates({
      ...validResponse.vehicles[0],
      current_longitude: null,
    })).toBe(false);
  });
});
