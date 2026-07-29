'use client';

import { useI18n } from '@/context/I18nContext';
import type { Order } from './api-contracts';
import { ModalDialog } from './ModalDialog';
import { StatusBadge } from './StatusBadge';

export function PodPreviewModal({
  order,
  onClose,
}: {
  order: Order | null;
  onClose: () => void;
}) {
  const { locale, t } = useI18n();
  const uploadedAt = order?.pod_uploaded_at
    ? new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(order.pod_uploaded_at))
    : t('orders.podTimeUnknown');

  return (
    <ModalDialog
      open={order !== null}
      eyebrow={t('orders.podEyebrow')}
      title={order ? t('orders.podTitle', { code: order.order_code }) : t('orders.podTitleFallback')}
      description={t('orders.podDescription')}
      onClose={onClose}
    >
      {order && (
        <div className="max-h-[calc(100vh-13rem)] space-y-5 overflow-y-auto p-5 sm:p-6">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-950">
            {order.pod_url ? (
              <img
                className="max-h-[55vh] w-full object-contain"
                src={order.pod_url}
                alt={t('orders.podImageAlt', { code: order.order_code })}
              />
            ) : (
              <div className="grid min-h-64 place-items-center p-8 text-center text-sm text-slate-500">
                {t('orders.noPodImage')}
              </div>
            )}
          </div>

          <dl className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-950/60 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('common.status')}</dt>
              <dd className="mt-1"><StatusBadge status={order.status} /></dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('orders.podUploadedAt')}</dt>
              <dd className="mt-1 font-medium text-slate-900 dark:text-white">{uploadedAt}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('orders.podNote')}</dt>
              <dd className="mt-1 leading-6 text-slate-700 dark:text-slate-300">{order.delivery_note || t('orders.noPodNote')}</dd>
            </div>
          </dl>

          {order.pod_url && (
            <div className="flex justify-end">
              <a
                className="inline-flex h-10 items-center rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
                href={order.pod_url}
                target="_blank"
                rel="noreferrer"
              >
                {t('orders.openPodOriginal')}
              </a>
            </div>
          )}
        </div>
      )}
    </ModalDialog>
  );
}
