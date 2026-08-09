export type Depot = {
  id: string;
  code: string;
  name: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  is_default: boolean;
  vehicle_count: number;
  active_orders_count: number;
  total_vehicle_capacity_kg: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * Leaflet throws when a coordinate is NaN. Validate values at the UI boundary
 * because number inputs can briefly emit an invalid intermediate value while
 * the dispatcher is editing a depot.
 */
export function isValidDepotCoordinates(
  value: unknown,
): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.latitude === 'number'
    && Number.isFinite(value.latitude)
    && value.latitude >= -90
    && value.latitude <= 90
    && typeof value.longitude === 'number'
    && Number.isFinite(value.longitude)
    && value.longitude >= -180
    && value.longitude <= 180
  );
}

export function canAnimateDepotMap(
  position: unknown,
  isActive: boolean,
  containerWidth: number,
  containerHeight: number,
): boolean {
  return (
    isActive
    && containerWidth > 0
    && containerHeight > 0
    && isValidDepotCoordinates(position)
  );
}

export function isDepot(value: unknown): value is Depot {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string'
    && typeof value.code === 'string'
    && typeof value.name === 'string'
    && typeof value.city === 'string'
    && typeof value.address === 'string'
    && isValidDepotCoordinates(value)
    && typeof value.is_default === 'boolean'
    && typeof value.vehicle_count === 'number'
    && Number.isInteger(value.vehicle_count)
    && value.vehicle_count >= 0
    && typeof value.active_orders_count === 'number'
    && Number.isInteger(value.active_orders_count)
    && value.active_orders_count >= 0
    && isNonNegativeNumber(value.total_vehicle_capacity_kg)
  );
}

export function isDepotList(value: unknown): value is Depot[] {
  return Array.isArray(value) && value.every(isDepot);
}

export function selectInitialDepot(
  depots: Depot[],
  storedDepotId: string | null,
): Depot | null {
  return depots.find((depot) => depot.id === storedDepotId)
    ?? depots.find((depot) => depot.is_default)
    ?? depots[0]
    ?? null;
}

export function withDepotQuery(path: string, depotId: string | null): string {
  if (!depotId) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}depot_id=${encodeURIComponent(depotId)}`;
}
