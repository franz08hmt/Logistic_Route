import { describe, expect, it } from 'vitest';

import {
  buildOsrmRouteUrl,
  buildRoutePositions,
  parseOsrmRouteGeometry,
} from './map-data';
import type { OptimizationResult } from './types';

const result: OptimizationResult = {
  status: 'OPTIMAL',
  route_batch_id: 'batch-1',
  depot: {
    id: 'depot-1',
    name: 'Kho Quận 12',
    address: 'Quận 12, TP.HCM',
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

describe('buildOsrmRouteUrl', () => {
  it('uses longitude-latitude order and keeps the optimized stop sequence', () => {
    const url = new URL(
      buildOsrmRouteUrl(
        result.depot,
        result.routes[0].stops,
        'https://router.example.test/',
      ),
    );

    expect(url.origin).toBe('https://router.example.test');
    expect(url.pathname).toBe(
      '/route/v1/driving/106.6535,10.8632;106.665,10.838;106.603,10.765;106.6535,10.8632',
    );
    expect(url.searchParams.get('overview')).toBe('full');
    expect(url.searchParams.get('geometries')).toBe('geojson');
    expect(url.searchParams.get('steps')).toBe('false');
  });
});

describe('parseOsrmRouteGeometry', () => {
  it('converts GeoJSON longitude-latitude coordinates to Leaflet tuples', () => {
    expect(
      parseOsrmRouteGeometry({
        code: 'Ok',
        routes: [
          {
            geometry: {
              type: 'LineString',
              coordinates: [
                [106.6535, 10.8632],
                [106.665, 10.838],
              ],
            },
          },
        ],
      }),
    ).toEqual([
      [10.8632, 106.6535],
      [10.838, 106.665],
    ]);
  });

  it.each([
    { code: 'NoRoute', routes: [] },
    { code: 'Ok', routes: [{ geometry: { coordinates: [] } }] },
    {
      code: 'Ok',
      routes: [{ geometry: { coordinates: [['invalid', 10.8]] } }],
    },
  ])('returns null for an unusable OSRM response', (payload) => {
    expect(parseOsrmRouteGeometry(payload)).toBeNull();
  });
});
