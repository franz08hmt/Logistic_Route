export type GeocodingResult = {
  id: string;
  formatted_address: string;
  latitude: number;
  longitude: number;
  region: string | null;
};

export type OrderLocationValue = {
  address: string;
  latitude: number;
  longitude: number;
  region: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCoordinate(value: unknown, min: number, max: number): value is number {
  return (
    typeof value === 'number'
    && Number.isFinite(value)
    && value >= min
    && value <= max
  );
}

export function isGeocodingResult(value: unknown): value is GeocodingResult {
  return (
    isRecord(value)
    && typeof value.id === 'string'
    && value.id.length > 0
    && typeof value.formatted_address === 'string'
    && value.formatted_address.length > 0
    && isCoordinate(value.latitude, -90, 90)
    && isCoordinate(value.longitude, -180, 180)
    && (typeof value.region === 'string' || value.region === null)
  );
}

export function isGeocodingResultList(
  value: unknown,
): value is GeocodingResult[] {
  return Array.isArray(value) && value.every(isGeocodingResult);
}

export function geocodingResultToLocation(
  result: GeocodingResult,
  fallbackRegion: string | null,
): OrderLocationValue {
  return {
    address: result.formatted_address,
    latitude: result.latitude,
    longitude: result.longitude,
    region: result.region ?? fallbackRegion ?? '',
  };
}
