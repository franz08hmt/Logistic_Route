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

export type OptimizationResult = {
  status: string;
  depot: {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  total_distance_km: number;
  total_duration_mins: number;
  unassigned_orders: string[];
  routes: OptimizedRoute[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isOptimizationResult(value: unknown): value is OptimizationResult {
  if (!isRecord(value) || !isRecord(value.depot) || !Array.isArray(value.routes)) {
    return false;
  }

  return (
    typeof value.status === 'string' &&
    typeof value.total_distance_km === 'number' &&
    typeof value.total_duration_mins === 'number' &&
    typeof value.depot.id === 'string' &&
    typeof value.depot.name === 'string' &&
    typeof value.depot.address === 'string' &&
    typeof value.depot.latitude === 'number' &&
    typeof value.depot.longitude === 'number' &&
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
