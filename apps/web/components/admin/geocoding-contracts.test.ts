import { describe, expect, it } from 'vitest';

import {
  geocodingResultToLocation,
  isGeocodingResult,
  isGeocodingResultList,
} from './geocoding-contracts';

describe('geocoding response validation', () => {
  it('accepts normalized autocomplete results with coordinates', () => {
    const result = {
      id: 'geoapify-place-1',
      formatted_address: '12 Nguyen Hue, District 1, Ho Chi Minh City',
      latitude: 10.7756,
      longitude: 106.7039,
      region: 'District 1',
    };

    expect(isGeocodingResult(result)).toBe(true);
    expect(isGeocodingResultList([result])).toBe(true);
  });

  it('rejects coordinates outside valid latitude and longitude ranges', () => {
    expect(isGeocodingResult({
      id: 'invalid-place',
      formatted_address: 'Invalid',
      latitude: 200,
      longitude: 106.587,
      region: null,
    })).toBe(false);
  });

  it('binds the selected formatted address and coordinates to order location', () => {
    expect(geocodingResultToLocation({
      id: 'place-1',
      formatted_address: '12 Nguyen Hue, District 1, Ho Chi Minh City',
      latitude: 10.7756,
      longitude: 106.7039,
      region: null,
    }, 'District 1')).toEqual({
      address: '12 Nguyen Hue, District 1, Ho Chi Minh City',
      latitude: 10.7756,
      longitude: 106.7039,
      region: 'District 1',
    });
  });
});
