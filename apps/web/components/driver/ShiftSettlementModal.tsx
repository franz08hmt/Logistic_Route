'use client';

import { useEffect, useState } from 'react';

import { ModalDialog } from '@/components/admin/ModalDialog';
import {
  fetchShiftSettlementPreview,
  submitShiftSettlement,
  type ShiftSettlementPreview,
} from '@/components/cod/cod-contracts';
import { formatVnd } from '@/components/cod/cod-format';
import { useI18n } from '@/context/I18nContext';

type ShiftSettlementModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
};

export function ShiftSettlementModal({
  open,
  onClose,
  onSubmitted,
}: ShiftSettlementModalProps) {
  const { t, locale } = useI18n();
  const [preview, setPreview] = useState<ShiftSettlementPreview | null>(null);
  const [declaredCash, setDeclaredCash] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setDeclaredCash('');
      setNotes('');
      setError(null);
      setSuccess(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetchShiftSettlementPreview()
      .then((result) => {
        if (cancelled) {
          return;
        }
        setPreview(result);
        // Prefill with what the system expects; the driver edits it if short.
        setDeclaredCash(String(result.expected_cash_amount));
      })
      .catch(() => {
        if (!cancelled) {
          setError(t('cod.loadError'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, t]);

  const declaredAmount = Number.parseInt(declaredCash || '0', 10);
  const safeDeclared = Number.isFinite(declaredAmount) && declaredAmount >= 0
    ? declaredAmount
    : 0;
  const variance = preview ? safeDeclared - preview.expected_cash_amount : 0;

  const handleSubmit = async () => {
    if (!preview?.can_submit || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const settlement = await submitShiftSettlement(safeDeclared, notes);
      setSuccess(
        t('driver.settlement.success', { code: settlement.settlement_code }),
      );
      setPreview(null);
      onSubmitted?.();
    } catch {
      setError(t('driver.settlement.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      eyebrow={t('cod.eyebrow')}
      title={t('driver.settlement.title')}
      description={t('driver.settlement.description')}
    >
      <div className="max-h-[min(72vh,46rem)] overflow-y-auto px-5 py-5 sm:px-6">
        {isLoading && (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            {t('cod.loading')}
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-sm bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-200"
          >
            {error}
          </p>
        )}

        {success && (
          <div className="space-y-4">
            <p
              role="status"
              className="rounded-sm bg-amber-50 px-4 py-4 text-sm font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
            >
              ✅ {success}
            </p>
            <button
              type="button"
              className="w-full rounded-sm px-4 py-3 text-sm font-bold bg-amber-700 dark:bg-amber-400 text-white dark:text-slate-950"
              onClick={onClose}
            >
              {t('driver.settlement.close')}
            </button>
          </div>
        )}

        {preview && !isLoading && !success && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 rounded-sm bg-slate-50 p-4 dark:bg-slate-800/60">
              <Fact
                label={t('driver.settlement.vehicle')}
                value={preview.license_plate ?? '—'}
              />
              <Fact
                label={t('driver.settlement.depot')}
                value={preview.depot_name ?? '—'}
              />
              <Fact
                label={t('driver.settlement.orders')}
                value={String(preview.total_orders_count)}
              />
              <Fact
                label={t('driver.settlement.delivered')}
                value={`${preview.delivered_count} / ${preview.total_orders_count}`}
              />
            </div>

            {preview.orders.length === 0 ? (
              <p className="rounded-sm bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-900 dark:bg-orange-950/50 dark:text-orange-200">
                {t('driver.settlement.empty')}
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <AmountRow
                    label={t('driver.settlement.expectedCash')}
                    value={formatVnd(preview.expected_cash_amount, locale)}
                    emphasis
                  />
                  <AmountRow
                    label={t('driver.settlement.vietqr')}
                    value={formatVnd(preview.total_vietqr_collected, locale)}
                  />
                  <AmountRow
                    label={t('driver.settlement.totalCod')}
                    value={formatVnd(preview.total_cod_expected, locale)}
                  />
                </div>

                <div>
                  <label
                    className="block text-sm font-semibold"
                    htmlFor="declared-cash"
                  >
                    {t('driver.settlement.declaredCash')}
                  </label>
                  <input
                    id="declared-cash"
                    type="number"
                    min={0}
                    step={1000}
                    inputMode="numeric"
                    value={declaredCash}
                    onChange={(event) => setDeclaredCash(event.target.value)}
                    className="mt-2 w-full rounded-sm border border-slate-200 px-4 py-3 text-lg font-bold tabular-nums dark:border-slate-700 dark:bg-slate-950"
                  />
                  {variance !== 0 && (
                    <p
                      className={`mt-2 text-sm font-semibold ${
                        variance < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-orange-600 dark:text-orange-400'
                      }`}
                    >
                      {t('driver.settlement.variance')}:{' '}
                      {formatVnd(variance, locale)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold" htmlFor="settlement-notes">
                    {t('driver.settlement.notes')}
                  </label>
                  <textarea
                    id="settlement-notes"
                    rows={2}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className="mt-2 w-full rounded-sm border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>

                <details className="rounded-sm border border-slate-200 px-4 py-3 dark:border-slate-700">
                  <summary className="cursor-pointer text-sm font-semibold">
                    {t('driver.settlement.orderList')} ({preview.orders.length})
                  </summary>
                  <ul className="mt-3 space-y-2">
                    {preview.orders.map((order) => (
                      <li
                        key={order.id}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="font-semibold">{order.order_code}</span>
                          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                            {order.customer_name}
                          </span>
                        </span>
                        <span className="shrink-0 font-bold tabular-nums">
                          {order.cod_amount > 0
                            ? formatVnd(order.cod_amount, locale)
                            : t('cod.paymentMethod.PREPAID')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>

                <button
                  type="button"
                  disabled={!preview.can_submit || isSubmitting}
                  className="w-full rounded-sm bg-amber-700 dark:bg-amber-400 px-4 py-3.5 text-base font-bold text-white dark:text-slate-950 transition hover:bg-amber-800 dark:hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
                  onClick={handleSubmit}
                >
                  {isSubmitting
                    ? t('driver.settlement.submitting')
                    : t('driver.settlement.submit')}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </ModalDialog>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-bold">{value}</p>
    </div>
  );
}

function AmountRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-sm px-4 py-3 ${
        emphasis
          ? 'bg-amber-50 dark:bg-amber-950/50'
          : 'bg-slate-50 dark:bg-slate-800/60'
      }`}
    >
      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
        {label}
      </span>
      <span
        className={`text-base font-black tabular-nums ${
          emphasis ? 'text-amber-700 dark:text-amber-300' : ''
        }`}
      >
        {value}
      </span>
    </div>
  );
}
