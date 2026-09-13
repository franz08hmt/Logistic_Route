import type { CodLedgerItem, CodStatus, ShiftSettlement } from './cod-contracts';

/** Vietnamese dong has no sub-unit, so COD amounts are always whole numbers. */
export function formatVnd(amount: number, locale: 'vi' | 'en' = 'vi'): string {
  const formatted = new Intl.NumberFormat(
    locale === 'vi' ? 'vi-VN' : 'en-US',
    { maximumFractionDigits: 0 },
  ).format(Math.abs(Math.trunc(amount)));
  const signed = amount < 0 ? `-${formatted}` : formatted;
  return locale === 'vi' ? `${signed} đ` : `${signed} VND`;
}

/** A compact hero-tile amount: 2,15 tr / 1,2 tỷ instead of a 10 digit number. */
export function formatVndCompact(
  amount: number,
  locale: 'vi' | 'en' = 'vi',
): string {
  const value = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  const decimal = new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    maximumFractionDigits: 1,
  });

  if (value >= 1_000_000_000) {
    const unit = locale === 'vi' ? ' tỷ' : 'B';
    return `${sign}${decimal.format(value / 1_000_000_000)}${unit}`;
  }
  if (value >= 1_000_000) {
    const unit = locale === 'vi' ? ' tr' : 'M';
    return `${sign}${decimal.format(value / 1_000_000)}${unit}`;
  }
  return formatVnd(amount, locale);
}

export type SettlementVariance = 'balanced' | 'short' | 'over';

/** How the declared cash compares with what the system expected. */
export function settlementVariance(
  settlement: Pick<ShiftSettlement, 'variance_amount'>,
): SettlementVariance {
  if (settlement.variance_amount === 0) {
    return 'balanced';
  }
  return settlement.variance_amount < 0 ? 'short' : 'over';
}

export function codStatusTone(status: CodStatus): string {
  switch (status) {
    case 'RECONCILED':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200';
    case 'COLLECTED':
      return 'bg-orange-100 text-orange-900 dark:bg-orange-900/50 dark:text-orange-200';
    case 'FAILED':
      return 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200';
    default:
      return 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }
}

function csvCell(value: string | number | null): string {
  let text = String(value ?? '');
  // Excel treats a leading =, +, -, or @ as a formula, so neutralise it.
  if (typeof value === 'string' && /^\s*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replaceAll('"', '""')}"`;
}

export type CodCsvLabels = {
  orderCode: string;
  customer: string;
  address: string;
  depot: string;
  vehicle: string;
  driver: string;
  orderStatus: string;
  amount: string;
  paymentMethod: string;
  codStatus: string;
  collectedAt: string;
  reconciledAt: string;
  settlementCode: string;
};

export function buildCodLedgerCsv(
  items: CodLedgerItem[],
  labels: CodCsvLabels,
): string {
  const rows = [
    [
      labels.orderCode,
      labels.customer,
      labels.address,
      labels.depot,
      labels.vehicle,
      labels.driver,
      labels.orderStatus,
      labels.amount,
      labels.paymentMethod,
      labels.codStatus,
      labels.collectedAt,
      labels.reconciledAt,
      labels.settlementCode,
    ].map(csvCell).join(','),
    ...items.map((item) => [
      csvCell(item.order_code),
      csvCell(item.customer_name),
      csvCell(item.address),
      csvCell(item.depot_name),
      csvCell(item.license_plate),
      csvCell(item.driver_name),
      csvCell(item.status),
      csvCell(item.cod_amount),
      csvCell(item.payment_method),
      csvCell(item.cod_status),
      csvCell(item.cod_collected_at),
      csvCell(item.cod_reconciled_at),
      csvCell(item.settlement_code),
    ].join(',')),
  ];
  return rows.join('\r\n');
}

export function downloadCodLedgerCsv(
  items: CodLedgerItem[],
  labels: CodCsvLabels,
): void {
  // The BOM is what makes Excel read the Vietnamese diacritics as UTF-8.
  const blob = new Blob(
    ['﻿', buildCodLedgerCsv(items, labels)],
    { type: 'text/csv;charset=utf-8' },
  );
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `logiroute-cod-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
