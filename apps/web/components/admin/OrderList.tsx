'use client';

import { useState } from 'react';

import { useI18n } from '@/context/I18nContext';
import { failureReasonTranslationKey } from '../delivery-failure';
import type { Order } from './api-contracts';
import { PodPreviewModal } from './PodPreviewModal';
import { StatusBadge } from './StatusBadge';

function DeliveryEvidence({
  order,
  onOpenPod,
}: {
  order: Order;
  onOpenPod: (order: Order) => void;
}) {
  const { t } = useI18n();

  if (order.status === 'DELIVERED') {
    return order.pod_url ? (
      <button
        type="button"
        className="mt-2 block text-xs font-semibold text-teal-700 underline-offset-2 hover:underline dark:text-teal-300"
        onClick={() => onOpenPod(order)}
      >
        {t('orders.openPod')}
      </button>
    ) : (
      <small className="mt-2 block text-xs text-slate-400">{t('orders.noPodImage')}</small>
    );
  }

  if (order.status !== 'FAILED') {
    return null;
  }
  const translatedFailureReason = failureReasonTranslationKey(
    order.failure_reason,
  );

  return (
    <details className="mt-2 text-xs">
      <summary className="font-semibold text-rose-700 dark:text-rose-300">{t('orders.exceptionDetails')}</summary>
      <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-3 leading-5 text-slate-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-slate-300">
        <p>
          <strong>{t('orders.failureReason')}</strong>{' '}
          {translatedFailureReason
            ? t(translatedFailureReason)
            : order.failure_reason || t('orders.noFailureReason')}
        </p>
        <p><strong>{t('orders.podNote')}</strong> {order.delivery_note || t('orders.noPodNote')}</p>
        {order.pod_url && (
          <button
            type="button"
            className="mt-1 inline-block font-semibold text-teal-700 underline-offset-2 hover:underline dark:text-teal-300"
            onClick={() => onOpenPod(order)}
          >
            {t('orders.openPod')}
          </button>
        )}
      </div>
    </details>
  );
}

export function OrderList({
  orders,
  isLoading,
  deletingId,
  onDelete,
  onDispatch,
}: {
  orders: Order[];
  isLoading: boolean;
  deletingId: string | null;
  onDelete: (order: Order) => void;
  onDispatch: (order: Order) => void;
}) {
  const { locale, t } = useI18n();
  const [podOrder, setPodOrder] = useState<Order | null>(null);
  const weightFormatter = new Intl.NumberFormat(
    locale === 'vi' ? 'vi-VN' : 'en-US',
    { maximumFractionDigits: 1 },
  );

  if (isLoading) {
    return (
      <div className="space-y-3 p-4" aria-label={t('orders.loading')} aria-busy="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="grid min-h-64 place-items-center px-4 py-12 text-center" role="status">
        <div>
          <span className="mx-auto grid size-11 place-items-center rounded-full bg-teal-50 text-xl text-teal-700 dark:bg-teal-950 dark:text-teal-300" aria-hidden="true">＋</span>
          <h3 className="mt-3 text-sm font-semibold text-slate-950 dark:text-white">{t('orders.emptyTitle')}</h3>
          <p className="mt-1 text-sm text-slate-500">{t('orders.emptyDescription')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="divide-y divide-slate-200 dark:divide-slate-800 md:hidden">
        {orders.map((order) => (
          <article key={order.id} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <strong className="text-sm text-slate-950 dark:text-white">{order.order_code}</strong>
                <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{order.customer_name}</p>
              </div>
              <StatusBadge status={order.status} />
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-950/60">
              <p className="leading-5 text-slate-700 dark:text-slate-300">{order.address}</p>
              <p className="mt-1 text-xs text-slate-500">{order.latitude.toFixed(4)}, {order.longitude.toFixed(4)} · {weightFormatter.format(order.weight_kg)} kg</p>
            </div>
            <DeliveryEvidence order={order} onOpenPod={setPodOrder} />
            <div className="flex flex-wrap gap-3">
              {(order.status === 'PENDING' || order.status === 'FAILED') && (
                <button
                  type="button"
                  className="text-xs font-semibold text-teal-700 hover:underline dark:text-teal-300"
                  onClick={() => onDispatch(order)}
                >
                  {t('orders.dispatchAction')}
                </button>
              )}
              <button
                type="button"
                className="text-xs font-semibold text-rose-700 hover:underline disabled:opacity-50 dark:text-rose-300"
                onClick={() => onDelete(order)}
                disabled={deletingId === order.id}
              >
                {deletingId === order.id ? t('orders.deleting') : t('orders.deleteOrder')}
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-4xl border-collapse text-left">
          <caption className="sr-only">{t('orders.tableCaption')}</caption>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/50">
              {[t('orders.code'), t('orders.customer'), t('orders.deliveryPoint'), t('orders.weight'), t('common.status'), ''].map((heading) => (
                <th key={heading} scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {orders.map((order) => (
              <tr key={order.id} className="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-slate-950 dark:text-white">{order.order_code}</td>
                <td className="px-5 py-4 text-sm text-slate-700 dark:text-slate-300">{order.customer_name}</td>
                <td className="max-w-sm px-5 py-4">
                  <p className="text-sm leading-5 text-slate-700 dark:text-slate-300">{order.address}</p>
                  <small className="mt-1 block text-xs text-slate-500">{order.latitude.toFixed(4)}, {order.longitude.toFixed(4)}</small>
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-700 dark:text-slate-300">{weightFormatter.format(order.weight_kg)} kg</td>
                <td className="px-5 py-4">
                  <StatusBadge status={order.status} />
                  <DeliveryEvidence order={order} onOpenPod={setPodOrder} />
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    {(order.status === 'PENDING' || order.status === 'FAILED') && (
                      <button
                        type="button"
                        className="rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100 focus-visible:outline-2 focus-visible:outline-teal-600 dark:bg-teal-950/50 dark:text-teal-300"
                        onClick={() => onDispatch(order)}
                      >
                        {t('orders.dispatchAction')}
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-rose-600 disabled:opacity-50 dark:text-rose-300 dark:hover:bg-rose-950/50"
                      onClick={() => onDelete(order)}
                      disabled={deletingId === order.id}
                      aria-label={t('orders.deleteLabel', { code: order.order_code })}
                    >
                      {deletingId === order.id ? t('orders.deleting') : t('orders.delete')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PodPreviewModal order={podOrder} onClose={() => setPodOrder(null)} />
    </>
  );
}
