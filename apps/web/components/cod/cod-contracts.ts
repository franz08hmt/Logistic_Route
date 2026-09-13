import { requestApi } from '../admin/api-contracts';

export const PAYMENT_METHODS = ['COD_CASH', 'VIETQR', 'PREPAID'] as const;
export const COD_STATUSES = [
  'PENDING',
  'COLLECTED',
  'RECONCILED',
  'FAILED',
] as const;
export const SETTLEMENT_STATUSES = [
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
] as const;
export const ORDER_STATUSES = [
  'PENDING',
  'ASSIGNED',
  'DELIVERING',
  'DELIVERED',
  'FAILED',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type CodStatus = (typeof COD_STATUSES)[number];
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];
export type CodOrderStatus = (typeof ORDER_STATUSES)[number];
/** Payment methods a driver can record at the door; PREPAID is set upstream. */
export type CollectablePaymentMethod = Exclude<PaymentMethod, 'PREPAID'>;

export type CodSummary = {
  depot_id: string | null;
  depot_name: string | null;
  total_cod_expected: number;
  total_cash_in_hand: number;
  total_vietqr_paid: number;
  total_reconciled: number;
  pending_settlements_count: number;
  pending_orders_count: number;
};

export type ShiftSettlement = {
  id: string;
  settlement_code: string;
  depot_id: string;
  depot_name: string | null;
  driver_id: string;
  driver_name: string | null;
  driver_email: string | null;
  vehicle_id: string;
  license_plate: string | null;
  total_orders_count: number;
  delivered_count: number;
  failed_count: number;
  total_cod_expected: number;
  expected_cash_amount: number;
  total_cash_collected: number;
  total_vietqr_collected: number;
  /** Declared cash minus expected cash; negative means the driver is short. */
  variance_amount: number;
  status: SettlementStatus;
  submitted_at: string;
  approved_at: string | null;
  approved_by_id: string | null;
  approved_by_name: string | null;
  notes: string | null;
  review_note: string | null;
};

export type CodLedgerItem = {
  order_id: string;
  order_code: string;
  customer_name: string;
  address: string;
  depot_id: string | null;
  depot_name: string | null;
  license_plate: string | null;
  driver_name: string | null;
  status: CodOrderStatus;
  cod_amount: number;
  payment_method: PaymentMethod;
  cod_status: CodStatus;
  cod_collected_at: string | null;
  cod_reconciled_at: string | null;
  settlement_code: string | null;
};

export type ShiftSettlementOrder = {
  id: string;
  order_code: string;
  customer_name: string;
  address: string;
  status: CodOrderStatus;
  cod_amount: number;
  payment_method: PaymentMethod;
  cod_status: CodStatus;
};

export type ShiftSettlementPreview = {
  depot_id: string | null;
  depot_name: string | null;
  vehicle_id: string | null;
  license_plate: string | null;
  total_orders_count: number;
  delivered_count: number;
  failed_count: number;
  total_cod_expected: number;
  expected_cash_amount: number;
  total_vietqr_collected: number;
  can_submit: boolean;
  orders: ShiftSettlementOrder[];
};

export type VietQrPayment = {
  order_code: string;
  amount: number;
  bank_code: string;
  bank_bin: string;
  account_no: string;
  account_name: string;
  add_info: string;
  /** EMVCo string rendered locally, so a printed bill needs no network. */
  payload: string;
  image_url: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isVndAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}

export function isCodSummary(value: unknown): value is CodSummary {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNullableString(value.depot_id)
    && isNullableString(value.depot_name)
    && isVndAmount(value.total_cod_expected)
    && isVndAmount(value.total_cash_in_hand)
    && isVndAmount(value.total_vietqr_paid)
    && isVndAmount(value.total_reconciled)
    && isVndAmount(value.pending_settlements_count)
    && isVndAmount(value.pending_orders_count)
  );
}

export function isShiftSettlement(value: unknown): value is ShiftSettlement {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string'
    && typeof value.settlement_code === 'string'
    && value.settlement_code.trim().length > 0
    && typeof value.depot_id === 'string'
    && isNullableString(value.depot_name)
    && typeof value.driver_id === 'string'
    && isNullableString(value.driver_name)
    && isNullableString(value.driver_email)
    && typeof value.vehicle_id === 'string'
    && isNullableString(value.license_plate)
    && isVndAmount(value.total_orders_count)
    && isVndAmount(value.delivered_count)
    && isVndAmount(value.failed_count)
    && isVndAmount(value.total_cod_expected)
    && isVndAmount(value.expected_cash_amount)
    && isVndAmount(value.total_cash_collected)
    && isVndAmount(value.total_vietqr_collected)
    // A shortfall is negative, so this one amount may be below zero.
    && typeof value.variance_amount === 'number'
    && Number.isInteger(value.variance_amount)
    && SETTLEMENT_STATUSES.includes(value.status as SettlementStatus)
    && typeof value.submitted_at === 'string'
    && isNullableString(value.approved_at)
    && isNullableString(value.approved_by_id)
    && isNullableString(value.approved_by_name)
    && isNullableString(value.notes)
    && isNullableString(value.review_note)
  );
}

export function isCodLedgerItem(value: unknown): value is CodLedgerItem {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.order_id === 'string'
    && typeof value.order_code === 'string'
    && typeof value.customer_name === 'string'
    && typeof value.address === 'string'
    && isNullableString(value.depot_id)
    && isNullableString(value.depot_name)
    && isNullableString(value.license_plate)
    && isNullableString(value.driver_name)
    && ORDER_STATUSES.includes(value.status as CodOrderStatus)
    && isVndAmount(value.cod_amount)
    && PAYMENT_METHODS.includes(value.payment_method as PaymentMethod)
    && COD_STATUSES.includes(value.cod_status as CodStatus)
    && isNullableString(value.cod_collected_at)
    && isNullableString(value.cod_reconciled_at)
    && isNullableString(value.settlement_code)
  );
}

export function isShiftSettlementOrder(
  value: unknown,
): value is ShiftSettlementOrder {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string'
    && typeof value.order_code === 'string'
    && typeof value.customer_name === 'string'
    && typeof value.address === 'string'
    && ORDER_STATUSES.includes(value.status as CodOrderStatus)
    && isVndAmount(value.cod_amount)
    && PAYMENT_METHODS.includes(value.payment_method as PaymentMethod)
    && COD_STATUSES.includes(value.cod_status as CodStatus)
  );
}

export function isShiftSettlementPreview(
  value: unknown,
): value is ShiftSettlementPreview {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNullableString(value.depot_id)
    && isNullableString(value.depot_name)
    && isNullableString(value.vehicle_id)
    && isNullableString(value.license_plate)
    && isVndAmount(value.total_orders_count)
    && isVndAmount(value.delivered_count)
    && isVndAmount(value.failed_count)
    && isVndAmount(value.total_cod_expected)
    && isVndAmount(value.expected_cash_amount)
    && isVndAmount(value.total_vietqr_collected)
    && typeof value.can_submit === 'boolean'
    && Array.isArray(value.orders)
    && value.orders.every(isShiftSettlementOrder)
  );
}

export function isVietQrPayment(value: unknown): value is VietQrPayment {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.order_code === 'string'
    && typeof value.amount === 'number'
    && Number.isInteger(value.amount)
    && value.amount > 0
    && typeof value.bank_code === 'string'
    && typeof value.bank_bin === 'string'
    && typeof value.account_no === 'string'
    && typeof value.account_name === 'string'
    && typeof value.add_info === 'string'
    && typeof value.payload === 'string'
    && value.payload.length > 0
    && typeof value.image_url === 'string'
  );
}

export type CodScope = {
  depotId?: string | null;
  nationwide?: boolean;
};

function scopeQuery(scope: CodScope = {}): URLSearchParams {
  const params = new URLSearchParams();
  if (scope.nationwide) {
    params.set('nationwide', 'true');
  } else if (scope.depotId) {
    params.set('depot_id', scope.depotId);
  }
  return params;
}

export async function fetchCodSummary(scope: CodScope = {}): Promise<CodSummary> {
  const query = scopeQuery(scope).toString();
  const payload = await requestApi(
    `/api/v1/cod/summary${query ? `?${query}` : ''}`,
  );
  if (!isCodSummary(payload)) {
    throw new Error('INVALID_COD_SUMMARY_RESPONSE');
  }
  return payload;
}

export async function fetchShiftSettlements(
  scope: CodScope = {},
  settlementStatus?: SettlementStatus,
): Promise<ShiftSettlement[]> {
  const params = scopeQuery(scope);
  if (settlementStatus) {
    params.set('settlement_status', settlementStatus);
  }
  const query = params.toString();
  const payload = await requestApi(
    `/api/v1/admin/cod/settlements${query ? `?${query}` : ''}`,
  );
  if (!Array.isArray(payload) || !payload.every(isShiftSettlement)) {
    throw new Error('INVALID_SETTLEMENT_LIST_RESPONSE');
  }
  return payload;
}

export type CodLedgerFilters = CodScope & {
  codStatus?: CodStatus;
  search?: string;
};

function ledgerQuery(filters: CodLedgerFilters): string {
  const params = scopeQuery(filters);
  if (filters.codStatus) {
    params.set('cod_status', filters.codStatus);
  }
  const search = filters.search?.trim();
  if (search) {
    params.set('search', search);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function fetchCodLedger(
  filters: CodLedgerFilters = {},
): Promise<CodLedgerItem[]> {
  const payload = await requestApi(
    `/api/v1/admin/cod/ledger${ledgerQuery(filters)}`,
  );
  if (!Array.isArray(payload) || !payload.every(isCodLedgerItem)) {
    throw new Error('INVALID_COD_LEDGER_RESPONSE');
  }
  return payload;
}

export function codExportPath(filters: CodLedgerFilters = {}): string {
  return `/api/v1/admin/cod/export${ledgerQuery(filters)}`;
}

export async function reviewShiftSettlement(
  settlementId: string,
  approved: boolean,
  reviewNote?: string,
): Promise<ShiftSettlement> {
  const action = approved ? 'approve' : 'reject';
  const payload = await requestApi(
    `/api/v1/admin/cod/settlements/${settlementId}/${action}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_note: reviewNote?.trim() || null }),
    },
  );
  if (!isShiftSettlement(payload)) {
    throw new Error('INVALID_SETTLEMENT_RESPONSE');
  }
  return payload;
}

export async function fetchShiftSettlementPreview(): Promise<ShiftSettlementPreview> {
  const payload = await requestApi('/api/v1/driver/shift-settlement/preview');
  if (!isShiftSettlementPreview(payload)) {
    throw new Error('INVALID_SETTLEMENT_PREVIEW_RESPONSE');
  }
  return payload;
}

export async function submitShiftSettlement(
  totalCashCollected: number,
  notes?: string,
): Promise<ShiftSettlement> {
  const payload = await requestApi('/api/v1/driver/shift-settlement/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      total_cash_collected: totalCashCollected,
      notes: notes?.trim() || null,
    }),
  });
  if (!isShiftSettlement(payload)) {
    throw new Error('INVALID_SETTLEMENT_RESPONSE');
  }
  return payload;
}

export async function fetchOrderVietQr(orderId: string): Promise<VietQrPayment> {
  const payload = await requestApi(`/api/v1/driver/orders/${orderId}/vietqr`);
  if (!isVietQrPayment(payload)) {
    throw new Error('INVALID_VIETQR_RESPONSE');
  }
  return payload;
}

export async function collectOrderCod(
  orderId: string,
  paymentMethod: CollectablePaymentMethod,
  receiptNote?: string,
): Promise<void> {
  await requestApi(`/api/v1/driver/orders/${orderId}/collect-cod`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payment_method: paymentMethod,
      cod_receipt_note: receiptNote?.trim() || null,
    }),
  });
}
