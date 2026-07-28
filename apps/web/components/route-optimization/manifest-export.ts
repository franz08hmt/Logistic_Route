import type { Order } from '../admin/api-contracts';
import type { OptimizationResult } from './types';


function escapeCsvCell(value: string | number | null): string {
  let text = value === null ? '' : String(value);

  if (
    typeof value === 'string' &&
    (/^\s*[=+\-@]/.test(text) || /^[\t\r]/.test(text))
  ) {
    text = `'${text}`;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

export function buildManifestCsv(
  result: OptimizationResult,
  orders: Order[],
): string {
  const ordersById = new Map(orders.map((order) => [order.id, order]));
  const headers = [
    'Vehicle',
    'Stop Sequence',
    'Order Code',
    'Customer Name',
    'Phone',
    'Address',
    'Latitude',
    'Longitude',
    'Weight Kg',
    'Route Distance Km',
    'Total Cost VND',
  ];
  const rows: Array<Array<string | number | null>> = [];

  for (const route of result.routes) {
    const orderedStops = [...route.stops].sort(
      (left, right) => left.stop_sequence - right.stop_sequence,
    );

    for (const stop of orderedStops) {
      const order = ordersById.get(stop.order_id);
      rows.push([
        route.license_plate,
        stop.stop_sequence,
        order?.order_code ?? stop.order_id,
        order?.customer_name ?? '',
        order?.customer_phone ?? null,
        order?.address ?? stop.address,
        stop.latitude,
        stop.longitude,
        order?.weight_kg ?? null,
        route.distance_km,
        result.cost_metrics.total_cost_vnd,
      ]);
    }
  }

  const csvLines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];

  return `\uFEFF${csvLines.join('\r\n')}`;
}

export function downloadManifestCsv(
  result: OptimizationResult,
  orders: Order[],
): void {
  const blob = new Blob(
    [buildManifestCsv(result, orders)],
    { type: 'text/csv;charset=utf-8' },
  );
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);

  link.href = objectUrl;
  link.download = `logiroute-manifest-${date}.csv`;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
