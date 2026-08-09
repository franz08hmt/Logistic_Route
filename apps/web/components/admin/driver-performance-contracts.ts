export const PERFORMANCE_PERIODS = [7, 14, 30] as const;
export const PERFORMANCE_TIERS = ['GOLD', 'SILVER', 'BRONZE'] as const;

export type PerformancePeriod = (typeof PERFORMANCE_PERIODS)[number];
export type PerformanceTier = (typeof PERFORMANCE_TIERS)[number];

export type DriverPerformanceItem = {
  driver_id: string;
  driver_name: string;
  email: string;
  phone_number: string | null;
  license_plate: string | null;
  vehicle_type: string | null;
  total_orders_handled: number;
  delivered_count: number;
  failed_count: number;
  success_rate: number;
  route_adherence_score: number;
  total_distance_km: number;
  estimated_co2_saved_kg: number;
  overall_score: number;
  tier_badge: PerformanceTier;
  is_eco_driver: boolean;
  rank: number;
};

export type DriverPerformanceResponse = {
  period_days: PerformancePeriod;
  total_co2_saved_all_kg: number;
  drivers: DriverPerformanceItem[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}

function isFiniteRange(value: unknown, min: number, max = Infinity): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= min
    && value <= max;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isDriverPerformanceItem(value: unknown, expectedRank: number): value is DriverPerformanceItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.driver_id === 'string'
    && typeof value.driver_name === 'string'
    && typeof value.email === 'string'
    && isNullableString(value.phone_number)
    && isNullableString(value.license_plate)
    && isNullableString(value.vehicle_type)
    && isNonNegativeInteger(value.total_orders_handled)
    && isNonNegativeInteger(value.delivered_count)
    && isNonNegativeInteger(value.failed_count)
    && value.total_orders_handled === value.delivered_count + value.failed_count
    && isFiniteRange(value.success_rate, 0, 100)
    && isFiniteRange(value.route_adherence_score, 0, 100)
    && isFiniteRange(value.total_distance_km, 0)
    && isFiniteRange(value.estimated_co2_saved_kg, 0)
    && isFiniteRange(value.overall_score, 0, 100)
    && PERFORMANCE_TIERS.includes(value.tier_badge as PerformanceTier)
    && typeof value.is_eco_driver === 'boolean'
    && value.rank === expectedRank
  );
}

export function isDriverPerformanceResponse(
  value: unknown,
): value is DriverPerformanceResponse {
  if (!isRecord(value)) return false;
  return (
    PERFORMANCE_PERIODS.includes(value.period_days as PerformancePeriod)
    && isFiniteRange(value.total_co2_saved_all_kg, 0)
    && Array.isArray(value.drivers)
    && value.drivers.every((driver, index) => (
      isDriverPerformanceItem(driver, index + 1)
    ))
  );
}
