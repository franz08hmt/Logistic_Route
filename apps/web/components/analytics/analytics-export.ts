import type { AnalyticsDataPoint } from './analytics-contracts';

export type AnalyticsCsvLabels = {
  date: string;
  distance: string;
  duration: string;
  fuelCost: string;
  driverCost: string;
  totalCost: string;
  savings: string;
  co2: string;
  co2Saved: string;
  runs: string;
};

function escapeCsvCell(value: string | number): string {
  let text = String(value);
  if (typeof value === 'string' && /^\s*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildAnalyticsCsv(
  points: AnalyticsDataPoint[],
  labels: AnalyticsCsvLabels,
): string {
  const headers = [
    labels.date,
    labels.distance,
    labels.duration,
    labels.fuelCost,
    labels.driverCost,
    labels.totalCost,
    labels.savings,
    labels.co2,
    labels.co2Saved,
    labels.runs,
  ];
  const rows = points.map((point) => [
    point.date,
    point.total_distance_km,
    point.total_duration_mins,
    point.fuel_cost_vnd,
    point.driver_cost_vnd,
    point.total_cost_vnd,
    point.estimated_savings_vnd,
    point.co2_emissions_kg,
    point.estimated_co2_savings_kg,
    point.optimization_runs,
  ]);
  return `\uFEFF${[
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ].join('\r\n')}`;
}

export function downloadAnalyticsCsv(
  points: AnalyticsDataPoint[],
  labels: AnalyticsCsvLabels,
): void {
  const blob = new Blob(
    [buildAnalyticsCsv(points, labels)],
    { type: 'text/csv;charset=utf-8' },
  );
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);

  link.href = objectUrl;
  link.download = `logiroute-analytics-${date}.csv`;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
