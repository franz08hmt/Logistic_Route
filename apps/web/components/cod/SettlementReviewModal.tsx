'use client';

import { useEffect, useState } from 'react';

import { ModalDialog } from '@/components/admin/ModalDialog';
import { useI18n } from '@/context/I18nContext';

import { reviewShiftSettlement, type ShiftSettlement } from './cod-contracts';
import { formatVnd, settlementVariance } from './cod-format';

type SettlementReviewModalProps = {
  settlement: ShiftSettlement | null;
  approving: boolean;
  onClose: () => void;
  onReviewed: () => void;
};

export function SettlementReviewModal({
  settlement,
  approving,
  onClose,
  onReviewed,
}: SettlementReviewModalProps) {
  const { t, locale } = useI18n();
  const [reviewNote, setReviewNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReviewNote('');
    setError(null);
  }, [settlement?.id, approving]);

  const handleReview = async () => {
    if (!settlement || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await reviewShiftSettlement(settlement.id, approving, reviewNote);
      onReviewed();
    } catch {
      setError(t('cod.reviewError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const variance = settlement ? settlementVariance(settlement) : 'balanced';

  return (
    <ModalDialog
      open={settlement !== null}
      onClose={onClose}
      eyebrow={settlement?.settlement_code ?? ''}
      title={
        approving
          ? t('cod.approveModal.title')
          : t('cod.approveModal.rejectTitle')
      }
      description={
        approving
          ? t('cod.approveModal.description')
          : t('cod.approveModal.rejectDescription')
      }
    >
      <div className="max-h-[min(70vh,42rem)] space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
        {settlement && (
          <>
            <div className="space-y-2">
              <AmountRow
                label={t('cod.approveModal.expected')}
                value={formatVnd(settlement.expected_cash_amount, locale)}
              />
              <AmountRow
                label={t('cod.approveModal.declared')}
                value={formatVnd(settlement.total_cash_collected, locale)}
                emphasis
              />
              <AmountRow
                label={t('cod.settlements.vietqr')}
                value={formatVnd(settlement.total_vietqr_collected, locale)}
              />
            </div>

            {variance !== 'balanced' && (
              <p
                role="alert"
                className="rounded-sm bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-900 dark:bg-orange-950/50 dark:text-orange-200"
              >
                ⚠ {t('cod.approveModal.varianceWarning', {
                  amount: formatVnd(Math.abs(settlement.variance_amount), locale),
                })}
              </p>
            )}

            {settlement.notes && (
              <p className="rounded-sm bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/60">
                <strong className="font-semibold">
                  {t('cod.settlements.notes')}:
                </strong>{' '}
                {settlement.notes}
              </p>
            )}

            <label className="block text-sm font-semibold" htmlFor="review-note">
              {t('cod.settlements.reviewNote')}
              <input
                id="review-note"
                className="mt-1 w-full rounded-sm border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                value={reviewNote}
                maxLength={1000}
                placeholder={t('cod.approveModal.notePlaceholder')}
                onChange={(event) => setReviewNote(event.target.value)}
                disabled={isSubmitting}
              />
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-sm bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-200"
              >
                {error}
              </p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                disabled={isSubmitting}
                className={`flex-1 rounded-sm px-4 py-3 text-sm font-bold text-white transition disabled:bg-slate-300 dark:disabled:bg-slate-700 ${
                  approving
                    ? 'bg-amber-700 hover:bg-amber-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
                onClick={handleReview}
              >
                {approving
                  ? t('cod.approveModal.confirm')
                  : t('cod.approveModal.rejectConfirm')}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                className="flex-1 rounded-sm border border-slate-200 px-4 py-3 text-sm font-semibold transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                onClick={onClose}
              >
                {t('cod.approveModal.cancel')}
              </button>
            </div>
          </>
        )}
      </div>
    </ModalDialog>
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
