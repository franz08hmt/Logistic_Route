import { describe, expect, it } from 'vitest';

import { shouldRecenterMap } from './map-position';

describe('order location map synchronization', () => {
  it('recenters when a selected address has different coordinates', () => {
    expect(shouldRecenterMap(
      { latitude: 10.7769, longitude: 106.7009 },
      { latitude: 10.8831, longitude: 106.5881 },
    )).toBe(true);
  });

  it('does not recenter when Leaflet is already at the selected coordinates', () => {
    expect(shouldRecenterMap(
      { latitude: 10.8831, longitude: 106.5881 },
      { latitude: 10.8831, longitude: 106.5881 },
    )).toBe(false);
  });

  it('ignores insignificant floating-point movement from Leaflet', () => {
    expect(shouldRecenterMap(
      { latitude: 10.88310001, longitude: 106.58810001 },
      { latitude: 10.8831, longitude: 106.5881 },
    )).toBe(false);
  });
});
