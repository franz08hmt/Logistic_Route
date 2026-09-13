import { describe, expect, it } from 'vitest';

import type { CodLedgerItem } from './cod-contracts';
import {
  buildCodLedgerCsv,
  formatVnd,
  formatVndCompact,
  settlementVariance,
} from './cod-format';

const labels = {
  orderCode: 'Mã đơn hàng',
  customer: 'Khách hàng',
  address: 'Địa chỉ',
  depot: 'Hub',
  vehicle: 'Biển số xe',
  driver: 'Tài xế',
  orderStatus: 'Trạng thái đơn',
  amount: 'Số tiền COD',
  paymentMethod: 'Phương thức',
  codStatus: 'Trạng thái COD',
  collectedAt: 'Thời điểm thu',
  reconciledAt: 'Thời điểm nộp quỹ',
  settlementCode: 'Mã phiếu bàn giao',
};

function ledgerItem(overrides: Partial<CodLedgerItem> = {}): CodLedgerItem {
  return {
    order_id: 'order-1',
    order_code: 'LR-COD-001',
    customer_name: 'Lê Thị Khách',
    address: '9 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM',
    depot_id: 'depot-1',
    depot_name: 'Hub Tân Bình',
    license_plate: '51F-888.88',
    driver_name: 'Nguyễn Văn Tài',
    status: 'DELIVERED',
    cod_amount: 350_000,
    payment_method: 'COD_CASH',
    cod_status: 'COLLECTED',
    cod_collected_at: '2026-09-12T10:15:00Z',
    cod_reconciled_at: null,
    settlement_code: null,
    ...overrides,
  };
}

describe('formatVnd', () => {
  it('renders whole dong with the Vietnamese suffix', () => {
    expect(formatVnd(350_000, 'vi')).toMatch(/^350.000 đ$/);
  });

  it('renders the English form with a VND suffix', () => {
    expect(formatVnd(350_000, 'en')).toBe('350,000 VND');
  });

  it('keeps a shortfall negative rather than dropping the sign', () => {
    expect(formatVnd(-50_000, 'en')).toBe('-50,000 VND');
  });

  it('renders zero', () => {
    expect(formatVnd(0, 'en')).toBe('0 VND');
  });

  it('truncates any fractional dong because VND has no sub-unit', () => {
    expect(formatVnd(350_000.9, 'en')).toBe('350,000 VND');
  });
});

describe('formatVndCompact', () => {
  it('abbreviates millions', () => {
    expect(formatVndCompact(2_150_000, 'en')).toBe('2.2M');
  });

  it('abbreviates billions', () => {
    expect(formatVndCompact(1_200_000_000, 'en')).toBe('1.2B');
  });

  it('falls back to the full amount below a million', () => {
    expect(formatVndCompact(350_000, 'en')).toBe('350,000 VND');
  });

  it('keeps a negative total readable', () => {
    expect(formatVndCompact(-2_150_000, 'en')).toBe('-2.2M');
  });
});

describe('settlementVariance', () => {
  it('reports a balanced handover', () => {
    expect(settlementVariance({ variance_amount: 0 })).toBe('balanced');
  });

  it('reports a shortfall when the driver hands over less than expected', () => {
    expect(settlementVariance({ variance_amount: -50_000 })).toBe('short');
  });

  it('reports an overage', () => {
    expect(settlementVariance({ variance_amount: 20_000 })).toBe('over');
  });
});

describe('buildCodLedgerCsv', () => {
  it('emits a header row plus one row per order', () => {
    const csv = buildCodLedgerCsv(
      [ledgerItem(), ledgerItem({ order_id: 'order-2', order_code: 'LR-COD-002' })],
      labels,
    );

    const rows = csv.split('\r\n');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('"Mã đơn hàng"');
    expect(rows[1]).toContain('"LR-COD-001"');
    expect(rows[2]).toContain('"LR-COD-002"');
  });

  it('keeps Vietnamese diacritics intact', () => {
    const csv = buildCodLedgerCsv([ledgerItem()], labels);
    expect(csv).toContain('"Lê Thị Khách"');
    expect(csv).toContain('"Hub Tân Bình"');
  });

  it('neutralises a formula so Excel treats it as text', () => {
    const csv = buildCodLedgerCsv(
      [ledgerItem({ customer_name: '=HYPERLINK("http://evil","click")' })],
      labels,
    );
    expect(csv).toContain("\"'=HYPERLINK(");
  });

  it('escapes embedded quotes by doubling them', () => {
    const csv = buildCodLedgerCsv(
      [ledgerItem({ customer_name: 'Công ty "ABC"' })],
      labels,
    );
    expect(csv).toContain('"Công ty ""ABC"""');
  });

  it('renders a missing settlement code as an empty cell', () => {
    const csv = buildCodLedgerCsv([ledgerItem()], labels);
    expect(csv.split('\r\n')[1].endsWith('""')).toBe(true);
  });

  it('writes the COD amount as a plain number for spreadsheet maths', () => {
    const csv = buildCodLedgerCsv([ledgerItem({ cod_amount: 1_250_000 })], labels);
    expect(csv).toContain('"1250000"');
  });
});
