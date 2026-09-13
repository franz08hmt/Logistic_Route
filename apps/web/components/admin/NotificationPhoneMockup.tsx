'use client';

import { useState } from 'react';

import { useI18n } from '@/context/I18nContext';
import { ModalDialog } from './ModalDialog';
import type { CustomerNotification } from './notification-contracts';

function safeTrackingUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function NotificationPhoneMockup({
  notification,
  onClose,
}: {
  notification: CustomerNotification | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const trackingUrl = safeTrackingUrl(notification?.tracking_url ?? null);
  const isZalo = notification?.channel === 'ZALO_ZNS';

  async function copyMessage() {
    if (!notification) return;
    try {
      await navigator.clipboard.writeText(notification.message_content);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  }

  return (
    <ModalDialog
      open={notification !== null}
      eyebrow={t('notifications.phonePreview')}
      title={notification?.title ?? t('notifications.title')}
      description={t('notifications.phonePreviewDescription')}
      onClose={() => {
        setCopyState('idle');
        onClose();
      }}
    >
      {notification && (
        <div className="max-h-[70vh] overflow-y-auto px-5 py-6 sm:px-6">
          <div className="mx-auto w-full max-w-[20rem] rounded-[2.5rem] border-[8px] border-slate-900 bg-slate-100 p-2 dark:border-slate-700 dark:bg-slate-950">
            <div className="mx-auto mb-3 h-5 w-24 rounded-b-sm bg-slate-900 dark:bg-slate-700" />
            <div className={`rounded-sm p-4 ${isZalo ? 'bg-sky-50 dark:bg-sky-950/40' : 'bg-violet-50 dark:bg-violet-950/40'}`}>
              <div className="flex items-center gap-3 border-b border-slate-200 pb-3 dark:border-slate-700">
                <span className={`grid size-10 place-items-center rounded-full text-sm font-black text-white ${isZalo ? 'bg-sky-600' : 'bg-violet-600'}`}>LR</span>
                <div>
                  <p className="text-sm font-semibold text-slate-950 dark:text-white">{t('notifications.logirouteSender')}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{isZalo ? t('notifications.zalo') : t('notifications.sms')}</p>
                </div>
              </div>
              <div className="mt-5 rounded-sm rounded-tl-sm bg-white p-4 text-sm dark:bg-slate-900">
                <p className="font-semibold text-slate-950 dark:text-white">{notification.title}</p>
                <p className="mt-2 whitespace-pre-wrap leading-6 text-slate-700 dark:text-slate-200">{notification.message_content}</p>
                {trackingUrl && (
                  <a className="mt-3 block break-all font-semibold text-amber-700 underline underline-offset-2 dark:text-amber-300" href={trackingUrl} target="_blank" rel="noreferrer">
                    {t('notifications.openTracking')}
                  </a>
                )}
              </div>
              <p className="mt-3 text-center text-[11px] text-slate-500 dark:text-slate-400">{new Date(notification.sent_at).toLocaleString()}</p>
            </div>
          </div>
          <button type="button" className="mx-auto mt-5 flex items-center justify-center rounded-sm bg-amber-700 dark:bg-amber-400 px-4 py-2.5 text-sm font-semibold text-white dark:text-slate-950 transition hover:bg-amber-800 dark:hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600" onClick={() => void copyMessage()}>
            {copyState === 'copied' ? t('notifications.copied') : t('notifications.copyMessage')}
          </button>
          <p className={`mt-2 text-center text-xs ${copyState === 'error' ? 'text-rose-600' : 'text-slate-500 dark:text-slate-400'}`} aria-live="polite">
            {copyState === 'error' ? t('notifications.copyError') : ''}
          </p>
        </div>
      )}
    </ModalDialog>
  );
}
