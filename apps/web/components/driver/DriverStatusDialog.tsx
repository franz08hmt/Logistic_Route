import type { ChangeEventHandler, FormEventHandler } from 'react';

import { useI18n } from '@/context/I18nContext';
import {
  fieldInputClass,
  fieldLabelClass,
  fieldTextareaClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../admin/form-styles';
import { ModalDialog } from '../admin/ModalDialog';
import type { DriverOrderStatus, DriverStop } from './driver-contracts';
import { driverStatusTranslationKeys, updateDriverStatuses } from './driver-ui';

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
  error,
  isSubmitting,
  onStatusChange,
  onDeliveryNoteChange,
  onFailureReasonChange,
  onPodFileChange,
  onClose,
  onSubmit,
}: {
  stop: DriverStop | null;
  status: DriverOrderStatus;
  deliveryNote: string;
  failureReason: string;
  podPreviewUrl: string;
  hasSelectedFile: boolean;
  error: string | null;
  isSubmitting: boolean;
  onStatusChange: (status: DriverOrderStatus) => void;
  onDeliveryNoteChange: (note: string) => void;
  onFailureReasonChange: (reason: string) => void;
  onPodFileChange: ChangeEventHandler<HTMLInputElement>;
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
}) {
  const { t } = useI18n();
  const delivered = status === 'DELIVERED';
  const failed = status === 'FAILED';

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

        <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700" aria-labelledby="pod-image-title">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="pod-image-title" className="text-sm font-semibold text-slate-900 dark:text-white">{t('driver.podImage')}</h3>
              <p className="mt-1 text-xs text-slate-500">{delivered ? t('driver.podRequired') : t('driver.podOptional')}</p>
            </div>
            {podPreviewUrl && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">POD</span>}
          </div>

          {podPreviewUrl && (
            <img className="mt-3 max-h-48 w-full rounded-lg bg-slate-100 object-contain dark:bg-slate-950" src={podPreviewUrl} alt={t('driver.podImage')} />
          )}
          <label className="mt-3 flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-dashed border-teal-300 bg-teal-50 px-4 text-sm font-semibold text-teal-800 hover:bg-teal-100 focus-within:outline-2 focus-within:outline-teal-600 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300">
            {hasSelectedFile || podPreviewUrl ? t('driver.replacePhoto') : t('driver.choosePhoto')}
            <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={onPodFileChange} disabled={isSubmitting} />
          </label>
          <p className="mt-2 text-xs text-slate-500">{t('driver.photoHint')}</p>
        </section>

        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" role="alert">{error}</p>}
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
