import { describe, expect, it } from 'vitest';

import {
  codExportPath,
  isCodLedgerItem,
  isCodSummary,
  isShiftSettlement,
  isShiftSettlementPreview,
  isVietQrPayment,
} from './cod-contracts';

const summary = {
  depot_id: 'depot-1',
  depot_name: 'Hub Tân Bình',
  total_cod_expected: 4_800_000,
  total_cash_in_hand: 1_070_000,
  total_vietqr_paid: 720_000,
  total_reconciled: 350_000,
  pending_settlements_count: 2,
  pending_orders_count: 7,
};

const settlement = {
  id: 'settlement-1',
  settlement_code: 'STL-20260912-51F88888',
  depot_id: 'depot-1',
  depot_name: 'Hub Tân Bình',
  driver_id: 'driver-1',
  driver_name: 'Nguyễn Văn Tài',
  driver_email: 'driver1@logiroute.vn',
  vehicle_id: 'vehicle-1',
  license_plate: '51F-888.88',
  total_orders_count: 4,
  delivered_count: 3,
  failed_count: 1,
  total_cod_expected: 1_070_000,
  expected_cash_amount: 350_000,
  total_cash_collected: 300_000,
  total_vietqr_collected: 720_000,
  variance_amount: -50_000,
  status: 'SUBMITTED',
  submitted_at: '2026-09-12T11:30:00Z',
  approved_at: null,
  approved_by_id: null,
  approved_by_name: null,
  notes: 'Thiếu 50.000đ',
  review_note: null,
};

const ledgerItem = {
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
};

const vietQr = {
  order_code: 'LR-COD-001',
  amount: 350_000,
  bank_code: 'VCB',
  bank_bin: '970436',
  account_no: '0071001234567',
  account_name: 'CONG TY LOGIROUTE VIET NAM',
  add_info: 'Thanh toan COD LR-COD-001',
  payload: '00020101021238570010A000007270127...63047EA4',
  image_url: 'https://img.vietqr.io/image/970436-0071001234567-compact2.png',
};

describe('isCodSummary', () => {
  it('accepts a complete summary', () => {
    expect(isCodSummary(summary)).toBe(true);
  });

  it('accepts a nationwide summary with no depot', () => {
    expect(isCodSummary({ ...summary, depot_id: null, depot_name: null })).toBe(true);
  });

  it.each([
    ['a fractional amount', { total_cash_in_hand: 350_000.5 }],
    ['a negative amount', { total_reconciled: -1 }],
    ['a missing count', { pending_settlements_count: undefined }],
    ['a stringified amount', { total_cod_expected: '4800000' }],
  ])('rejects %s', (_label, override) => {
    expect(isCodSummary({ ...summary, ...override })).toBe(false);
  });

  it('rejects a non-object payload', () => {
    expect(isCodSummary(null)).toBe(false);
    expect(isCodSummary('summary')).toBe(false);
  });
});

describe('isShiftSettlement', () => {
  it('accepts a submitted settlement', () => {
    expect(isShiftSettlement(settlement)).toBe(true);
  });

  it('allows a negative variance because a shortfall is real', () => {
    expect(isShiftSettlement({ ...settlement, variance_amount: -250_000 })).toBe(true);
    expect(isShiftSettlement({ ...settlement, variance_amount: 0 })).toBe(true);
    expect(isShiftSettlement({ ...settlement, variance_amount: 40_000 })).toBe(true);
  });

  it('rejects an amount that is not a whole number of dong', () => {
    expect(isShiftSettlement({ ...settlement, variance_amount: -50_000.5 })).toBe(false);
    expect(isShiftSettlement({ ...settlement, total_cash_collected: -1 })).toBe(false);
  });

  it('rejects an unknown status', () => {
    expect(isShiftSettlement({ ...settlement, status: 'PAID' })).toBe(false);
  });

  it('rejects a blank settlement code', () => {
    expect(isShiftSettlement({ ...settlement, settlement_code: '  ' })).toBe(false);
  });

  it('accepts an approved settlement with a reviewer', () => {
    expect(
      isShiftSettlement({
        ...settlement,
        status: 'APPROVED',
        approved_at: '2026-09-12T12:00:00Z',
        approved_by_id: 'admin-1',
        approved_by_name: 'Trần Thu Quỹ',
        review_note: 'Đã kiểm đếm đủ',
      }),
    ).toBe(true);
  });
});

describe('isCodLedgerItem', () => {
  it('accepts a collected order', () => {
    expect(isCodLedgerItem(ledgerItem)).toBe(true);
  });

  it('rejects an unknown COD status or payment method', () => {
    expect(isCodLedgerItem({ ...ledgerItem, cod_status: 'SETTLED' })).toBe(false);
    expect(isCodLedgerItem({ ...ledgerItem, payment_method: 'MOMO' })).toBe(false);
  });

  it('rejects an unknown order status', () => {
    expect(isCodLedgerItem({ ...ledgerItem, status: 'RETURNED' })).toBe(false);
  });
});

describe('isShiftSettlementPreview', () => {
  const preview = {
    depot_id: 'depot-1',
    depot_name: 'Hub Tân Bình',
    vehicle_id: 'vehicle-1',
    license_plate: '51F-888.88',
    total_orders_count: 1,
    delivered_count: 1,
    failed_count: 0,
    total_cod_expected: 350_000,
    expected_cash_amount: 350_000,
    total_vietqr_collected: 0,
    can_submit: true,
    orders: [
      {
        id: 'order-1',
        order_code: 'LR-COD-001',
        customer_name: 'Lê Thị Khách',
        address: '9 Nguyễn Huệ, Quận 1, TP.HCM',
        status: 'DELIVERED',
        cod_amount: 350_000,
        payment_method: 'COD_CASH',
        cod_status: 'COLLECTED',
      },
    ],
  };

  it('accepts a preview with orders', () => {
    expect(isShiftSettlementPreview(preview)).toBe(true);
  });

  it('accepts an empty shift', () => {
    expect(
      isShiftSettlementPreview({ ...preview, orders: [], can_submit: false }),
    ).toBe(true);
  });

  it('rejects a preview whose orders are malformed', () => {
    expect(
      isShiftSettlementPreview({ ...preview, orders: [{ id: 'order-1' }] }),
    ).toBe(false);
  });
});

describe('isVietQrPayment', () => {
  it('accepts a dynamic payment', () => {
    expect(isVietQrPayment(vietQr)).toBe(true);
  });

  it('rejects a zero or fractional amount', () => {
    expect(isVietQrPayment({ ...vietQr, amount: 0 })).toBe(false);
    expect(isVietQrPayment({ ...vietQr, amount: 350_000.5 })).toBe(false);
  });

  it('rejects an empty payload because there would be nothing to render', () => {
    expect(isVietQrPayment({ ...vietQr, payload: '' })).toBe(false);
  });
});

describe('codExportPath', () => {
  it('defaults to the operational depot with no query', () => {
    expect(codExportPath()).toBe('/api/v1/admin/cod/export');
  });

  it('scopes to one hub', () => {
    expect(codExportPath({ depotId: 'depot-1' })).toBe(
      '/api/v1/admin/cod/export?depot_id=depot-1',
    );
  });

  it('prefers nationwide over a selected hub', () => {
    expect(codExportPath({ depotId: 'depot-1', nationwide: true })).toBe(
      '/api/v1/admin/cod/export?nationwide=true',
    );
  });

  it('carries filters and trims the search term', () => {
    expect(
      codExportPath({
        depotId: 'depot-1',
        codStatus: 'COLLECTED',
        search: '  LR-COD-001  ',
      }),
    ).toBe(
      '/api/v1/admin/cod/export?depot_id=depot-1&cod_status=COLLECTED&search=LR-COD-001',
    );
  });

  it('omits a search term that is only whitespace', () => {
    expect(codExportPath({ depotId: 'depot-1', search: '   ' })).toBe(
      '/api/v1/admin/cod/export?depot_id=depot-1',
    );
  });
});
