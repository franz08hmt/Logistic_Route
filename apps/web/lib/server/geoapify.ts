import type { GeocodingResult } from '@/components/admin/geocoding-contracts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function validCoordinate(value: unknown, min: number, max: number): value is number {
  return (
    typeof value === 'number'
    && Number.isFinite(value)
    && value >= min
    && value <= max
  );
}

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

/**
 * Treat Geoapify's external response as untrusted. This exposes only the
 * address fields required by the order form after validating their shape.
 */
export function normalizeGeoapifyAutocompleteResponse(
  payload: unknown,
): GeocodingResult[] {
  if (!isRecord(payload) || !Array.isArray(payload.features)) {
    return [];
  }

  return payload.features.flatMap((feature): GeocodingResult[] => {
    if (!isRecord(feature) || !isRecord(feature.properties)) {
      return [];
    }
    const properties = feature.properties;
    const id = properties.place_id;
    const formattedAddress = properties.formatted;
    if (
      (typeof id !== 'string' && typeof id !== 'number')
      || !String(id).trim()
      || typeof formattedAddress !== 'string'
      || !formattedAddress.trim()
      || !validCoordinate(properties.lat, -90, 90)
      || !validCoordinate(properties.lon, -180, 180)
    ) {
      return [];
    }

    return [{
      id: String(id),
      formatted_address: formattedAddress.trim(),
      latitude: properties.lat,
      longitude: properties.lon,
      region: firstNonEmptyString(
        properties.city_district,
        properties.district,
        properties.county,
        properties.suburb,
      ),
    }];
  });
}
