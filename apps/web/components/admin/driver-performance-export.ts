import type { DriverPerformanceItem } from './driver-performance-contracts';

export type DriverPerformanceCsvLabels = {
  rank: string;
  driver: string;
  email: string;
  phone: string;
  vehicle: string;
  orders: string;
  delivered: string;
  failed: string;
  successRate: string;
  adherence: string;
  distance: string;
  co2Saved: string;
  tier: string;
  score: string;
  ecoDriver: string;
};

function csvCell(value: string | number | boolean | null): string {
  let text = String(value ?? '');
  if (typeof value === 'string' && /^\s*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replaceAll('"', '""')}"`;
}

export function downloadDriverPerformanceCsv(
  drivers: DriverPerformanceItem[],
  labels: DriverPerformanceCsvLabels,
): void {
  const blob = new Blob(
    [buildDriverPerformanceCsv(drivers, labels)],
    { type: 'text/csv;charset=utf-8' },
  );
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `logiroute-driver-performance-${new Date().toISOString().slice(0, 10)}.csv`;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export function buildDriverPerformanceCsv(
  drivers: DriverPerformanceItem[],
  labels: DriverPerformanceCsvLabels,
): string {
  const header = [
    labels.rank,
    labels.driver,
    labels.email,
    labels.phone,
    labels.vehicle,
    labels.orders,
    labels.delivered,
    labels.failed,
    labels.successRate,
    labels.adherence,
    labels.distance,
    labels.co2Saved,
    labels.tier,
    labels.score,
    labels.ecoDriver,
  ];
  const rows = drivers.map((driver) => [
    driver.rank,
    driver.driver_name,
    driver.email,
    driver.phone_number,
    driver.license_plate,
    driver.total_orders_handled,
    driver.delivered_count,
    driver.failed_count,
    driver.success_rate,
    driver.route_adherence_score,
    driver.total_distance_km,
    driver.estimated_co2_saved_kg,
    driver.tier_badge,
    driver.overall_score,
    driver.is_eco_driver,
  ]);

  return `\uFEFF${[header, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n')}\r\n`;
}
