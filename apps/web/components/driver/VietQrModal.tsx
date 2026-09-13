'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

import { ModalDialog } from '@/components/admin/ModalDialog';
import { fetchOrderVietQr, type VietQrPayment } from '@/components/cod/cod-contracts';
import { formatVnd } from '@/components/cod/cod-format';
import { useI18n } from '@/context/I18nContext';

type VietQrModalProps = {
  open: boolean;
  orderId: string | null;
  onClose: () => void;
  onConfirmed?: () => void;
};

export function VietQrModal({
  open,
  orderId,
  onClose,
  onConfirmed,
}: VietQrModalProps) {
  const { t, locale } = useI18n();
  const [payment, setPayment] = useState<VietQrPayment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !orderId) {
      setPayment(null);
      setError(null);
      setCopiedField(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetchOrderVietQr(orderId)
      .then((result) => {
        if (!cancelled) {
          setPayment(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(t('driver.vietqr.loadError'));
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
  }, [open, orderId, t]);

  const copy = async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
    } catch {
      // Clipboard access can be denied; the value stays selectable on screen.
      setCopiedField(null);
    }
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      eyebrow="VietQR · NAPAS 24/7"
      title={t('driver.vietqr.title')}
      description={t('driver.vietqr.description')}
    >
      <div className="max-h-[min(70vh,44rem)] overflow-y-auto px-5 py-5 sm:px-6">
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

        {payment && !isLoading && (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-3 rounded-sm border border-amber-200 bg-white p-5 dark:border-amber-900 dark:bg-slate-950">
              {/* Rendered from the EMVCo payload, so the code works offline. */}
              <QRCodeSVG
                value={payment.payload}
                size={232}
                level="M"
                marginSize={2}
                title={t('bill.codQrTitle', { code: payment.order_code })}
                bgColor="#ffffff"
                fgColor="#0f172a"
              />
              <p className="text-3xl font-black tracking-tight text-amber-700 dark:text-amber-300">
                {formatVnd(payment.amount, locale)}
              </p>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                {payment.order_code}
              </p>
            </div>

            <dl className="space-y-2">
              <CopyRow
                label={t('driver.vietqr.bank')}
                value={`${payment.bank_code} · ${payment.bank_bin}`}
                copyValue={payment.bank_bin}
                field="bank"
                copiedField={copiedField}
                onCopy={copy}
                copyLabel={t('driver.vietqr.copy')}
                copiedLabel={t('driver.vietqr.copied')}
              />
              <CopyRow
                label={t('driver.vietqr.accountNo')}
                value={payment.account_no}
                copyValue={payment.account_no}
                field="account"
                copiedField={copiedField}
                onCopy={copy}
                copyLabel={t('driver.vietqr.copy')}
                copiedLabel={t('driver.vietqr.copied')}
              />
              <CopyRow
                label={t('driver.vietqr.accountName')}
                value={payment.account_name}
              />
              <CopyRow
                label={t('driver.vietqr.addInfo')}
                value={payment.add_info}
                copyValue={payment.add_info}
                field="memo"
                copiedField={copiedField}
                onCopy={copy}
                copyLabel={t('driver.vietqr.copy')}
                copiedLabel={t('driver.vietqr.copied')}
              />
            </dl>

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              {onConfirmed && (
                <button
                  type="button"
                  className="flex-1 rounded-sm bg-amber-700 dark:bg-amber-400 px-4 py-3 text-sm font-bold text-white dark:text-slate-950 transition hover:bg-amber-800 dark:hover:bg-amber-300"
                  onClick={onConfirmed}
                >
                  {t('driver.vietqr.confirm')}
                </button>
              )}
              <button
                type="button"
                className="flex-1 rounded-sm border border-slate-200 px-4 py-3 text-sm font-semibold transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                onClick={onClose}
              >
                {t('driver.vietqr.close')}
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalDialog>
  );
}

function CopyRow({
  label,
  value,
  copyValue,
  field,
  copiedField,
  onCopy,
  copyLabel,
  copiedLabel,
}: {
  label: string;
  value: string;
  copyValue?: string;
  field?: string;
  copiedField?: string | null;
  onCopy?: (field: string, value: string) => void;
  copyLabel?: string;
  copiedLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-sm bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          {label}
        </dt>
        <dd className="mt-0.5 truncate text-sm font-bold">{value}</dd>
      </div>
      {copyValue && field && onCopy && (
        <button
          type="button"
          className="shrink-0 rounded-sm border border-slate-200 px-3 py-1.5 text-xs font-semibold transition hover:bg-white dark:border-slate-700 dark:hover:bg-slate-900"
          onClick={() => onCopy(field, copyValue)}
        >
          {copiedField === field ? copiedLabel : copyLabel}
        </button>
      )}
    </div>
  );
}
