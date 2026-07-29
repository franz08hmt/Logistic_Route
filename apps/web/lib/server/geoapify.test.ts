import { describe, expect, it } from 'vitest';

import { normalizeGeoapifyAutocompleteResponse } from './geoapify';

describe('Geoapify autocomplete response normalization', () => {
  it('returns a safe typed address with coordinates from a GeoJSON feature', () => {
    expect(normalizeGeoapifyAutocompleteResponse({
      features: [{
        properties: {
          place_id: 'geoapify-place-1',
          formatted: '12 Nguyen Hue, Ben Nghe, District 1, Ho Chi Minh City',
          lat: 10.7756,
          lon: 106.7039,
          city_district: 'District 1',
        },
      }],
    })).toEqual([{
      id: 'geoapify-place-1',
      formatted_address: '12 Nguyen Hue, Ben Nghe, District 1, Ho Chi Minh City',
      latitude: 10.7756,
      longitude: 106.7039,
      region: 'District 1',
    }]);
  });

  it('drops malformed or out-of-range provider coordinates', () => {
    expect(normalizeGeoapifyAutocompleteResponse({
      features: [{
        properties: {
          place_id: 'unsafe',
          formatted: 'Invalid',
          lat: 999,
          lon: 106.7,
        },
      }],
    })).toEqual([]);
  });
});
