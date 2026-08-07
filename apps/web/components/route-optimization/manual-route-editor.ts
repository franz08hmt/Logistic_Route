import type {
  OptimizationResult,
  OptimizedRoute,
  RouteCostMetrics,
} from './types';

const EARTH_RADIUS_KM = 6_371;
const ROAD_CURVATURE_FACTOR = 1.25;
const PREVIEW_SPEED_KMH = 20;
const FUEL_LITERS_PER_100_KM = 12;
const FUEL_PRICE_VND_PER_LITER = 23_500;
const DRIVER_COST_VND_PER_MINUTE = 150_000 / 60;
const CO2_KG_PER_LITER = 2.31;
const SAVINGS_RATE = 0.18;

export type RouteReorderPayload = {
  route_batch_id: string;
  routes: Array<{
    vehicle_id: string;
    stops: Array<{ order_id: string; stop_sequence: number }>;
  }>;
};

type MoveRouteStopInput = {
  result: OptimizationResult;
  sourceVehicleId: string;
  sourceIndex: number;
  destinationVehicleId: string;
  destinationIndex: number;
  orderWeights: ReadonlyMap<string, number>;
  vehicleCapacities: ReadonlyMap<string, number>;
};

export type MoveRouteStopResult =
  | { ok: true; result: OptimizationResult }
  | {
    ok: false;
    reason: 'CAPACITY_EXCEEDED';
    vehicleId: string;
    capacityKg: number;
    attemptedWeightKg: number;
  }
  | { ok: false; reason: 'INVALID_MOVE' };

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const a = (
    Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(fromLatitude)
      * Math.cos(toLatitude)
      * Math.sin(longitudeDelta / 2) ** 2
  );
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

function calculateRouteDistance(
  route: OptimizedRoute,
  depot: OptimizationResult['depot'],
) {
  if (route.stops.length === 0) return 0;
  const points = [depot, ...route.stops, depot];
  let distanceKm = 0;
  for (let index = 1; index < points.length; index += 1) {
    distanceKm += haversineKm(points[index - 1], points[index]);
  }
  return distanceKm * ROAD_CURVATURE_FACTOR;
}

function calculateCostMetrics(
  distanceKm: number,
  durationMins: number,
): RouteCostMetrics {
  const fuelLiters = (distanceKm / 100) * FUEL_LITERS_PER_100_KM;
  const fuelCost = fuelLiters * FUEL_PRICE_VND_PER_LITER;
  const driverCost = durationMins * DRIVER_COST_VND_PER_MINUTE;
  const totalCost = fuelCost + driverCost;
  const co2 = fuelLiters * CO2_KG_PER_LITER;
  return {
    fuel_cost_vnd: Number(fuelCost.toFixed(2)),
    driver_cost_vnd: Number(driverCost.toFixed(2)),
    total_cost_vnd: Number(totalCost.toFixed(2)),
    co2_emissions_kg: Number(co2.toFixed(3)),
    estimated_savings_vnd: Number((totalCost * SAVINGS_RATE).toFixed(2)),
    estimated_co2_savings_kg: Number((co2 * SAVINGS_RATE).toFixed(3)),
    savings_rate: SAVINGS_RATE,
  };
}

function normalizeResult(
  result: OptimizationResult,
  orderWeights: ReadonlyMap<string, number>,
): OptimizationResult {
  const routes = result.routes.map((route) => {
    const stops = route.stops.map((stop, index) => ({
      ...stop,
      stop_sequence: index + 1,
    }));
    const nextRoute = { ...route, stops };
    return {
      ...nextRoute,
      total_weight_kg: stops.reduce(
        (total, stop) => total + (orderWeights.get(stop.order_id) ?? 0),
        0,
      ),
      distance_km: calculateRouteDistance(nextRoute, result.depot),
    };
  });
  const totalDistance = routes.reduce((total, route) => total + route.distance_km, 0);
  const totalDuration = (totalDistance / PREVIEW_SPEED_KMH) * 60;
  return {
    ...result,
    status: 'MANUAL_PREVIEW',
    routes,
    total_distance_km: Number(totalDistance.toFixed(3)),
    total_duration_mins: Number(totalDuration.toFixed(2)),
    cost_metrics: calculateCostMetrics(totalDistance, totalDuration),
  };
}

export function moveRouteStop(input: MoveRouteStopInput): MoveRouteStopResult {
  const sourceRouteIndex = input.result.routes.findIndex(
    (route) => route.vehicle_id === input.sourceVehicleId,
  );
  const destinationRouteIndex = input.result.routes.findIndex(
    (route) => route.vehicle_id === input.destinationVehicleId,
  );
  if (sourceRouteIndex < 0 || destinationRouteIndex < 0) {
    return { ok: false, reason: 'INVALID_MOVE' };
  }

  const routes = input.result.routes.map((route) => ({
    ...route,
    stops: route.stops.map((stop) => ({ ...stop })),
  }));
  const sourceStops = routes[sourceRouteIndex].stops;
  if (input.sourceIndex < 0 || input.sourceIndex >= sourceStops.length) {
    return { ok: false, reason: 'INVALID_MOVE' };
  }
  const [movedStop] = sourceStops.splice(input.sourceIndex, 1);
  const destinationStops = routes[destinationRouteIndex].stops;
  const destinationIndex = Math.max(
    0,
    Math.min(input.destinationIndex, destinationStops.length),
  );
  destinationStops.splice(destinationIndex, 0, movedStop);

  if (sourceRouteIndex !== destinationRouteIndex) {
    const attemptedWeightKg = destinationStops.reduce(
      (total, stop) => total + (input.orderWeights.get(stop.order_id) ?? 0),
      0,
    );
    const capacityKg = input.vehicleCapacities.get(input.destinationVehicleId);
    if (capacityKg !== undefined && attemptedWeightKg > capacityKg) {
      return {
        ok: false,
        reason: 'CAPACITY_EXCEEDED',
        vehicleId: input.destinationVehicleId,
        capacityKg,
        attemptedWeightKg,
      };
    }
  }

  return {
    ok: true,
    result: normalizeResult({ ...input.result, routes }, input.orderWeights),
  };
}

export function hasRoutePlanChanged(
  original: OptimizationResult | null,
  current: OptimizationResult | null,
) {
  if (!original || !current) return false;
  const signature = (result: OptimizationResult) => result.routes
    .flatMap((route) => route.stops.map((stop, index) => (
      `${route.vehicle_id}:${stop.order_id}:${index + 1}`
    )))
    .join('|');
  return signature(original) !== signature(current);
}

export function buildRouteReorderPayload(
  result: OptimizationResult,
): RouteReorderPayload {
  if (!result.route_batch_id) {
    throw new Error('Route result has no route_batch_id');
  }
  return {
    route_batch_id: result.route_batch_id,
    routes: result.routes.map((route) => ({
      vehicle_id: route.vehicle_id,
      stops: route.stops.map((stop, index) => ({
        order_id: stop.order_id,
        stop_sequence: index + 1,
      })),
    })),
  };
}
