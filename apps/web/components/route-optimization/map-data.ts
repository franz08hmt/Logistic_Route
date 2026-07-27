import type { LatLngTuple } from 'leaflet';

import type {
  OptimizationResult,
  OptimizationStop,
} from './types';

type Coordinate = {
  latitude: number;
  longitude: number;
};

const DEFAULT_OSRM_BASE_URL =
  process.env.NEXT_PUBLIC_OSRM_BASE_URL ?? 'https://router.project-osrm.org';

function toLatLng(point: Coordinate): LatLngTuple {
  return [point.latitude, point.longitude];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteCoordinatePair(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    Number.isFinite(value[0]) &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[1])
  );
}

export function buildRoutePositions(
  depot: Coordinate,
  stops: OptimizationStop[],
): LatLngTuple[] {
  const orderedStops = [...stops].sort(
    (left, right) => left.stop_sequence - right.stop_sequence,
  );

  return [
    toLatLng(depot),
    ...orderedStops.map(toLatLng),
    toLatLng(depot),
  ];
}

export function buildOsrmRouteUrl(
  depot: Coordinate,
  stops: OptimizationStop[],
  baseUrl = DEFAULT_OSRM_BASE_URL,
): string {
  const coordinates = buildRoutePositions(depot, stops)
    .map(([latitude, longitude]) => `${longitude},${latitude}`)
    .join(';');
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const query = new URLSearchParams({
    overview: 'full',
    geometries: 'geojson',
    steps: 'false',
  });

  return `${normalizedBaseUrl}/route/v1/driving/${coordinates}?${query.toString()}`;
}

export function parseOsrmRouteGeometry(
  payload: unknown,
): LatLngTuple[] | null {
  if (!isRecord(payload) || payload.code !== 'Ok' || !Array.isArray(payload.routes)) {
    return null;
  }

  const firstRoute = payload.routes[0];
  if (!isRecord(firstRoute) || !isRecord(firstRoute.geometry)) {
    return null;
  }

  const coordinates = firstRoute.geometry.coordinates;
  if (
    !Array.isArray(coordinates) ||
    coordinates.length < 2 ||
    !coordinates.every(isFiniteCoordinatePair)
  ) {
    return null;
  }

  return coordinates.map(([longitude, latitude]) => [latitude, longitude]);
}

export async function fetchOsrmRouteGeometry(
  depot: Coordinate,
  stops: OptimizationStop[],
  signal?: AbortSignal,
): Promise<LatLngTuple[] | null> {
  const response = await fetch(buildOsrmRouteUrl(depot, stops), { signal });
  if (!response.ok) {
    return null;
  }

  const payload: unknown = await response.json().catch(() => null);
  return parseOsrmRouteGeometry(payload);
}

export function buildAllMapPositions(
  result: OptimizationResult,
): LatLngTuple[] {
  return [
    toLatLng(result.depot),
    ...result.routes.flatMap((route) => route.stops.map(toLatLng)),
  ];
}
