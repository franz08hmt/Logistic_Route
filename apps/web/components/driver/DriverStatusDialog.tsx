import type { ChangeEventHandler, FormEventHandler, Ref } from 'react';

import { useI18n } from '@/context/I18nContext';
import {
  fieldInputClass,
  fieldLabelClass,
  fieldTextareaClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../admin/form-styles';
import { ModalDialog } from '../admin/ModalDialog';
import type { CollectablePaymentMethod } from '../cod/cod-contracts';
import { formatVnd } from '../cod/cod-format';
import type { DriverOrderStatus, DriverStop } from './driver-contracts';
import { driverStatusTranslationKeys, updateDriverStatuses } from './driver-ui';
import { SignaturePad, type SignaturePadHandle } from './SignaturePad';

const failureReasons = [
  ['CUSTOMER_UNAVAILABLE', 'driver.failureCustomerUnavailable'],
  ['WRONG_ADDRESS', 'driver.failureWrongAddress'],
  ['RESCHEDULED', 'driver.failureRescheduled'],
  ['REJECTED', 'driver.failureRejected'],
] as const;

export function DriverStatusDialog({
  stop,
  status,
  deliveryNote,
  failureReason,
  podPreviewUrl,
  hasSelectedFile,
  recipientName,
  hasDrawnSignature,
  signaturePadRef,
  paymentMethod,
  codReceiptNote,
  error,
  isSubmitting,
  onStatusChange,
  onPaymentMethodChange,
  onCodReceiptNoteChange,
  onShowVietQr,
  onDeliveryNoteChange,
  onFailureReasonChange,
  onPodFileChange,
  onRecipientNameChange,
  onSignaturePresenceChange,
  onClose,
  onSubmit,
}: {
  stop: DriverStop | null;
  status: DriverOrderStatus;
  deliveryNote: string;
  failureReason: string;
  podPreviewUrl: string;
  hasSelectedFile: boolean;
  recipientName: string;
  hasDrawnSignature: boolean;
  signaturePadRef: Ref<SignaturePadHandle>;
  paymentMethod: CollectablePaymentMethod;
  codReceiptNote: string;
  error: string | null;
  isSubmitting: boolean;
  onStatusChange: (status: DriverOrderStatus) => void;
  onPaymentMethodChange: (method: CollectablePaymentMethod) => void;
  onCodReceiptNoteChange: (note: string) => void;
  onShowVietQr: () => void;
  onDeliveryNoteChange: (note: string) => void;
  onFailureReasonChange: (reason: string) => void;
  onPodFileChange: ChangeEventHandler<HTMLInputElement>;
  onRecipientNameChange: (name: string) => void;
  onSignaturePresenceChange: (present: boolean) => void;
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
}) {
  const { t, locale } = useI18n();
  const delivered = status === 'DELIVERED';
  const failed = status === 'FAILED';
  // Only an unpaid COD stop needs the driver to choose how it was paid.
  const needsCodCollection = Boolean(
    delivered
      && stop
      && stop.cod_amount > 0
      && stop.payment_method !== 'PREPAID'
      && stop.cod_status === 'PENDING',
  );

  return (
    <ModalDialog
      open={stop !== null}
      eyebrow={t('driver.podEyebrow')}
      title={t('driver.dialogTitle')}
      description={stop ? `${stop.order_code} · ${stop.customer_name}` : ''}
      onClose={onClose}
    >
      <form className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-5 sm:px-6" onSubmit={onSubmit}>
        <label className={fieldLabelClass}>
          {t('driver.newStatus')}
          <select className={fieldInputClass} value={status} onChange={(event) => onStatusChange(event.target.value as DriverOrderStatus)} disabled={isSubmitting}>
            {updateDriverStatuses.map((nextStatus) => (
              <option key={nextStatus} value={nextStatus}>{t(driverStatusTranslationKeys[nextStatus])}</option>
            ))}
          </select>
        </label>

        {failed && (
          <label className={fieldLabelClass}>
            {t('driver.failureReasonSelect')} <span className="text-rose-600" aria-hidden="true">*</span>
            <select className={fieldInputClass} value={failureReason} onChange={(event) => onFailureReasonChange(event.target.value)} required disabled={isSubmitting}>
              <option value="">{t('driver.failureReasonSelect')}</option>
              {failureReasons.map(([value, key]) => <option key={value} value={value}>{t(key)}</option>)}
            </select>
          </label>
        )}

        <label className={fieldLabelClass}>
          {t('driver.deliveryNote')} <span className="font-normal text-slate-400">({t('common.optional')})</span>
          <textarea className={fieldTextareaClass} value={deliveryNote} onChange={(event) => onDeliveryNoteChange(event.target.value)} maxLength={2000} placeholder={t('driver.deliveryNotePlaceholder')} rows={3} disabled={isSubmitting} />
        </label>

        {needsCodCollection && stop && (
          <section className="rounded-sm border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/40" aria-labelledby="cod-collection-title">
            <h3 id="cod-collection-title" className="font-bold text-slate-900 dark:text-white text-base uppercase tracking-[0.14em]">
              {t('driver.cod.choosePayment')}
            </h3>
            <p className="mt-1 text-2xl font-black tabular-nums text-emerald-800 dark:text-emerald-300">
              {formatVnd(stop.cod_amount, locale)}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                aria-pressed={paymentMethod === 'COD_CASH'}
                disabled={isSubmitting}
                className={`min-h-12 rounded-sm border px-4 text-sm font-bold transition ${
                  paymentMethod === 'COD_CASH'
                    ? 'border-emerald-700 bg-emerald-700 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                }`}
                onClick={() => onPaymentMethodChange('COD_CASH')}
              >
                💵 {t('driver.cod.collectCash')}
              </button>
              <button
                type="button"
                aria-pressed={paymentMethod === 'VIETQR'}
                disabled={isSubmitting}
                className={`min-h-12 rounded-sm border px-4 text-sm font-bold transition ${
                  paymentMethod === 'VIETQR'
                    ? 'border-amber-700 bg-amber-700 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                }`}
                onClick={() => {
                  onPaymentMethodChange('VIETQR');
                  onShowVietQr();
                }}
              >
                📱 {t('driver.cod.showVietQR')}
              </button>
            </div>
            <label className={`${fieldLabelClass} mt-3`}>
              {t('driver.cod.receiptNote')}
              <input
                className={fieldInputClass}
                value={codReceiptNote}
                onChange={(event) => onCodReceiptNoteChange(event.target.value)}
                maxLength={500}
                disabled={isSubmitting}
              />
            </label>
          </section>
        )}

        <section className="rounded-sm border border-slate-200 p-4 dark:border-slate-700" aria-labelledby="pod-image-title">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="pod-image-title" className="font-bold text-slate-900 dark:text-white text-base uppercase tracking-[0.14em]">{t('driver.podImage')}</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{delivered ? t('driver.podRequired') : t('driver.podOptional')}</p>
            </div>
            {podPreviewUrl && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">POD</span>}
          </div>

          {podPreviewUrl && (
            <img className="mt-3 max-h-48 w-full rounded-sm bg-slate-100 object-contain dark:bg-slate-950" src={podPreviewUrl} alt={t('driver.podImage')} />
          )}
          <label className="mt-3 flex min-h-11 cursor-pointer items-center justify-center rounded-sm border border-dashed border-amber-300 bg-amber-50 px-4 text-sm font-semibold text-amber-800 hover:bg-amber-100 focus-within:outline-2 focus-within:outline-amber-600 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            {hasSelectedFile || podPreviewUrl ? t('driver.replacePhoto') : t('driver.choosePhoto')}
            <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={onPodFileChange} disabled={isSubmitting} />
          </label>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t('driver.photoHint')}</p>
        </section>

        {delivered && (
          <section className="rounded-sm border border-slate-200 p-4 dark:border-slate-700" aria-labelledby="recipient-signature-title">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="recipient-signature-title" className="font-bold text-slate-900 dark:text-white text-base uppercase tracking-[0.14em]">{t('signature.title')}</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('signature.requiredHint')}</p>
              </div>
              {(hasDrawnSignature || stop?.signature_url) && (
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{t('signature.ready')}</span>
              )}
            </div>

            <label className={`${fieldLabelClass} mt-4`}>
              {t('signature.recipientName')} <span className="text-rose-600" aria-hidden="true">*</span>
              <input
                className={fieldInputClass}
                value={recipientName}
                onChange={(event) => onRecipientNameChange(event.target.value)}
                maxLength={150}
                placeholder={t('signature.recipientPlaceholder')}
                required
                disabled={isSubmitting}
              />
            </label>

            {stop?.signature_url && !hasDrawnSignature && (
              <img
                className="mt-3 h-24 w-full rounded-sm border border-slate-200 bg-white object-contain p-2 dark:border-slate-700"
                src={stop.signature_url}
                alt={t('signature.existingAlt')}
              />
            )}
            <div className="mt-3">
              <SignaturePad
                key={stop?.id ?? 'empty-signature'}
                ref={signaturePadRef}
                disabled={isSubmitting}
                onEmptyChange={(empty) => onSignaturePresenceChange(!empty)}
              />
            </div>
          </section>
        )}

        {error && <p className="rounded-sm bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" role="alert">{error}</p>}
        <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white pt-4 dark:border-slate-800 dark:bg-slate-900">
          <button className={secondaryButtonClass} type="button" onClick={onClose} disabled={isSubmitting}>{t('common.cancel')}</button>
          <button className={primaryButtonClass} type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('driver.uploadingPhoto') : t('driver.saveStatus')}
          </button>
        </footer>
      </form>
    </ModalDialog>
  );
}
