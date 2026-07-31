export type AnalyticsDataPoint = {
  date: string;
  total_distance_km: number;
  total_duration_mins: number;
  total_cost_vnd: number;
  fuel_cost_vnd: number;
  driver_cost_vnd: number;
  co2_emissions_kg: number;
  estimated_savings_vnd: number;
  estimated_co2_savings_kg: number;
  optimization_runs: number;
};

export type AnalyticsSummary = {
  period_label: string;
  total_optimizations: number;
  total_distance_km: number;
  total_cost_vnd: number;
  total_savings_vnd: number;
  total_co2_saved_kg: number;
  avg_savings_rate: number;
  best_day: string | null;
  best_day_savings_vnd: number;
};

export type AnalyticsHistoryResponse = {
  summary: AnalyticsSummary;
  data_points: AnalyticsDataPoint[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return isNonNegativeNumber(value) && Number.isInteger(value);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime())
    && parsed.toISOString().slice(0, 10) === value;
}

function isAnalyticsDataPoint(value: unknown): value is AnalyticsDataPoint {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isIsoDate(value.date)
    && isNonNegativeNumber(value.total_distance_km)
    && isNonNegativeNumber(value.total_duration_mins)
    && isNonNegativeNumber(value.total_cost_vnd)
    && isNonNegativeNumber(value.fuel_cost_vnd)
    && isNonNegativeNumber(value.driver_cost_vnd)
    && isNonNegativeNumber(value.co2_emissions_kg)
    && isNonNegativeNumber(value.estimated_savings_vnd)
    && isNonNegativeNumber(value.estimated_co2_savings_kg)
    && isNonNegativeInteger(value.optimization_runs)
  );
}

function isAnalyticsSummary(value: unknown): value is AnalyticsSummary {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.period_label === 'string'
    && isNonNegativeInteger(value.total_optimizations)
    && isNonNegativeNumber(value.total_distance_km)
    && isNonNegativeNumber(value.total_cost_vnd)
    && isNonNegativeNumber(value.total_savings_vnd)
    && isNonNegativeNumber(value.total_co2_saved_kg)
    && isNonNegativeNumber(value.avg_savings_rate)
    && value.avg_savings_rate <= 1
    && (value.best_day === null || isIsoDate(value.best_day))
    && isNonNegativeNumber(value.best_day_savings_vnd)
  );
}

export function isAnalyticsHistory(
  value: unknown,
): value is AnalyticsHistoryResponse {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isAnalyticsSummary(value.summary)
    && Array.isArray(value.data_points)
    && value.data_points.every(isAnalyticsDataPoint)
  );
}
