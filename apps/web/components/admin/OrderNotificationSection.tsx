'use client';

import { useEffect, useState } from 'react';

import { useI18n } from '@/context/I18nContext';
import type { Order } from './api-contracts';
import { NotificationPhoneMockup } from './NotificationPhoneMockup';
import {
  fetchOrderNotifications,
  notificationTemplateForStatus,
  resendOrderNotification,
  type CustomerNotification,
  type NotificationChannel,
} from './notification-contracts';

export function OrderNotificationSection({ order }: { order: Order | null }) {
  const { locale, t } = useI18n();
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [preview, setPreview] = useState<CustomerNotification | null>(null);
  const [channel, setChannel] = useState<NotificationChannel>('ZALO_ZNS');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!order) return;
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    setNotice(null);
    setNotifications([]);
    void fetchOrderNotifications(order.id, controller.signal)
      .then(setNotifications)
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
        setError(requestError instanceof Error ? requestError.message : t('notifications.loadError'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [order, t]);

  async function resend() {
    if (!order) return;
    setIsResending(true);
    setError(null);
    setNotice(null);
    try {
      const notification = await resendOrderNotification(order.id, channel);
      setNotifications((current) => [notification, ...current]);
      setNotice(t('notifications.resendSuccess'));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('notifications.resendError'));
    } finally {
      setIsResending(false);
    }
  }

  if (!order) return null;
  const hasTemplate = notificationTemplateForStatus(order.status) !== null;

  return (
    <section className="mt-7" aria-labelledby="customer-notifications-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="customer-notifications-title" className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t('notifications.title')}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{t('notifications.description')}</p>
        </div>
      </div>

      {!order.customer_phone ? (
        <p className="mt-3 rounded-sm border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:text-slate-400 dark:border-slate-700">{t('notifications.noPhone')}</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2 rounded-sm border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50 sm:flex-row">
          <label className="flex-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
            {t('notifications.chooseChannel')}
            <select value={channel} onChange={(event) => setChannel(event.target.value as NotificationChannel)} className="mt-1.5 w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
              <option value="ZALO_ZNS">{t('notifications.zalo')}</option>
              <option value="SMS_BRANDNAME">{t('notifications.sms')}</option>
            </select>
          </label>
          <button type="button" disabled={!hasTemplate || isResending} className="self-end rounded-sm bg-amber-700 dark:bg-amber-400 px-3 py-2 text-sm font-semibold text-white dark:text-slate-950 transition hover:bg-amber-800 dark:hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void resend()}>
            {isResending ? t('notifications.resending') : t('notifications.resend')}
          </button>
        </div>
      )}
      {!hasTemplate && order.customer_phone && <p className="mt-2 text-xs text-orange-700 dark:text-orange-300">{t('notifications.noTemplate')}</p>}
      {(error || notice) && <p className={`mt-3 text-sm ${error ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`} role="status">{error ?? notice}</p>}

      {isLoading ? (
        <p className="mt-4 animate-pulse text-sm text-slate-500 dark:text-slate-400">{t('notifications.loading')}</p>
      ) : notifications.length === 0 ? (
        <p className="mt-4 rounded-sm border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:text-slate-400 dark:border-slate-700">{t('notifications.empty')}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {notifications.map((notification) => (
            <li key={notification.id} className="rounded-sm border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${notification.channel === 'ZALO_ZNS' ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200' : 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200'}`}>{notification.channel === 'ZALO_ZNS' ? t('notifications.zalo') : t('notifications.sms')}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(notification.sent_at))}</span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{notification.message_content}</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">✓ {t(`notifications.status.${notification.status}`)}</span>
                <button type="button" className="text-sm font-semibold text-amber-700 hover:underline dark:text-amber-300" onClick={() => setPreview(notification)}>{t('notifications.preview')}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <NotificationPhoneMockup notification={preview} onClose={() => setPreview(null)} />
    </section>
  );
}
