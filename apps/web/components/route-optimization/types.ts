export type OptimizationStop = {
  stop_sequence: number;
  order_id: string;
  address: string;
  latitude: number;
  longitude: number;
};

export type OptimizedRoute = {
  vehicle_id: string;
  license_plate: string;
  total_weight_kg: number;
  distance_km: number;
  stops: OptimizationStop[];
};

export type RouteCostMetrics = {
  fuel_cost_vnd: number;
  driver_cost_vnd: number;
  total_cost_vnd: number;
  co2_emissions_kg: number;
  estimated_savings_vnd: number;
  estimated_co2_savings_kg: number;
  savings_rate: number;
};

export type OptimizationResult = {
  status: string;
  route_batch_id: string | null;
  depot: {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  total_distance_km: number;
  total_duration_mins: number;
  cost_metrics: RouteCostMetrics;
  unassigned_orders: string[];
  routes: OptimizedRoute[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function isOptimizationResult(value: unknown): value is OptimizationResult {
  if (
    !isRecord(value) ||
    !isRecord(value.depot) ||
    !isRecord(value.cost_metrics) ||
    !Array.isArray(value.routes)
  ) {
    return false;
  }

  return (
    typeof value.status === 'string' &&
    (typeof value.route_batch_id === 'string' || value.route_batch_id === null) &&
    isNonNegativeFiniteNumber(value.total_distance_km) &&
    isNonNegativeFiniteNumber(value.total_duration_mins) &&
    typeof value.depot.id === 'string' &&
    typeof value.depot.name === 'string' &&
    typeof value.depot.address === 'string' &&
    typeof value.depot.latitude === 'number' &&
    typeof value.depot.longitude === 'number' &&
    isNonNegativeFiniteNumber(value.cost_metrics.fuel_cost_vnd) &&
    isNonNegativeFiniteNumber(value.cost_metrics.driver_cost_vnd) &&
    isNonNegativeFiniteNumber(value.cost_metrics.total_cost_vnd) &&
    isNonNegativeFiniteNumber(value.cost_metrics.co2_emissions_kg) &&
    isNonNegativeFiniteNumber(value.cost_metrics.estimated_savings_vnd) &&
    isNonNegativeFiniteNumber(value.cost_metrics.estimated_co2_savings_kg) &&
    isNonNegativeFiniteNumber(value.cost_metrics.savings_rate) &&
    value.cost_metrics.savings_rate <= 1 &&
    Array.isArray(value.unassigned_orders) &&
    value.unassigned_orders.every((orderId) => typeof orderId === 'string') &&
    value.routes.every(
      (route) =>
        isRecord(route) &&
        typeof route.vehicle_id === 'string' &&
        typeof route.license_plate === 'string' &&
        typeof route.total_weight_kg === 'number' &&
        typeof route.distance_km === 'number' &&
        Array.isArray(route.stops) &&
        route.stops.every(
          (stop) =>
            isRecord(stop) &&
            typeof stop.stop_sequence === 'number' &&
            typeof stop.order_id === 'string' &&
            typeof stop.address === 'string' &&
            typeof stop.latitude === 'number' &&
            typeof stop.longitude === 'number',
        ),
    )
  );
}
