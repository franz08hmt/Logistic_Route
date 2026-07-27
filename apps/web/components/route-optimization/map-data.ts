import type { LatLngTuple } from 'leaflet';

import type {
  OptimizationResult,
  OptimizationStop,
} from './types';

type Coordinate = {
  latitude: number;
  longitude: number;
};

function toLatLng(point: Coordinate): LatLngTuple {
  return [point.latitude, point.longitude];
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

export function buildAllMapPositions(
  result: OptimizationResult,
): LatLngTuple[] {
  return [
    toLatLng(result.depot),
    ...result.routes.flatMap((route) => route.stops.map(toLatLng)),
  ];
}
