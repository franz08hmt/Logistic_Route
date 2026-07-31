'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useI18n } from '@/context/I18nContext';
import {
  isPublicTrackingResponse,
  type PublicTrackingResponse,
  type PublicTrackingStatus,
} from '@/components/public/tracking-contracts';

const PublicTrackingMap = dynamic(
  () => import('@/components/public/PublicTrackingMap').then((module) => module.PublicTrackingMap),
  {
    ssr: false,
    loading: () => <div className="h-[21rem] animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800 sm:h-[26rem]" />,
  },
);

const stepKeys = [
  'tracking.stepReceived',
  'tracking.stepAssigned',
  'tracking.stepDelivering',
  'tracking.stepCompleted',
] as const;

const progressByStatus: Record<PublicTrackingStatus, number> = {
  PENDING: 0,
  ASSIGNED: 1,
  DELIVERING: 2,
  DELIVERED: 3,
  FAILED: 3,
};

export default function PublicTrackingPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const { locale, t } = useI18n();
  const [tracking, setTracking] = useState<PublicTrackingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorKind, setErrorKind] = useState<'not-found' | 'unavailable' | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadTracking = useCallback(async (signal?: AbortSignal, initial = false) => {
    if (initial) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    try {
      const response = await fetch(`/api/public/track/${encodeURIComponent(token)}`, {
        cache: 'no-store',
        signal,
      });
      if (response.status === 404) {
        setTracking(null);
        setErrorKind('not-found');
        return;
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload: unknown = await response.json();
      if (!isPublicTrackingResponse(payload)) {
        throw new Error('Invalid public tracking response');
      }
      setTracking(payload);
      setErrorKind(null);
      setLastRefresh(new Date());
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      setErrorKind('unavailable');
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    void loadTracking(controller.signal, true);
    const pollTimer = window.setInterval(() => {
      void loadTracking(controller.signal);
    }, 30_000);
    return () => {
      controller.abort();
      window.clearInterval(pollTimer);
    };
  }, [loadTracking]);

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }),
    [locale],
  );

  if (isLoading) {
    return <TrackingState title={t('tracking.loading')} description={t('tracking.loadingDescription')} />;
  }

  if (!tracking || errorKind) {
    return (
      <TrackingState
        title={errorKind === 'not-found' ? t('tracking.notFound') : t('tracking.unavailable')}
        description={errorKind === 'not-found' ? t('tracking.notFoundDescription') : t('tracking.unavailableDescription')}
        action={<button type="button" className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600" onClick={() => void loadTracking(undefined, true)}>{t('tracking.retry')}</button>}
      />
    );
  }

  const progress = progressByStatus[tracking.order.status];
  const isFailed = tracking.order.status === 'FAILED';
  const statusUpdated = tracking.order.status_updated_at
    ? dateFormatter.format(new Date(tracking.order.status_updated_at))
    : t('tracking.notAvailable');

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <header className="border-b border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-teal-600 text-sm font-black text-white shadow-sm">LR</span>
            <div><p className="font-semibold">LogiRoute VN</p><p className="text-xs text-slate-500 dark:text-slate-400">{t('tracking.portal')}</p></div>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-400">{t('tracking.orderCode')}</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{tracking.order.order_code}</h1></div>
            <div className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${isFailed ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'}`}><span className="size-2 rounded-full bg-current" />{t(`status.${tracking.order.status}`)}</div>
          </div>
          <TrackingProgress currentStep={progress} failed={isFailed} />
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <span>{t('tracking.lastStatusUpdate')}: {statusUpdated}</span>
            <span aria-live="polite">{isRefreshing ? t('tracking.refreshing') : t('tracking.autoRefresh')}</span>
            {lastRefresh && <span>{t('tracking.lastChecked')}: {dateFormatter.format(lastRefresh)}</span>}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4" aria-labelledby="tracking-map-title">
          <div className="mb-3 px-1"><h2 id="tracking-map-title" className="font-semibold">{t('tracking.routeMap')}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('tracking.mapDescription')}</p></div>
          <PublicTrackingMap tracking={tracking} />
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-semibold">{t('tracking.shippingInformation')}</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <Info label={t('tracking.recipient')} value={tracking.order.customer_name_masked} />
              <Info label={t('tracking.recipientPhone')} value={tracking.order.customer_phone_masked || t('tracking.notAvailable')} />
              <Info label={t('tracking.address')} value={tracking.order.address} />
              <Info label={t('tracking.stopPosition')} value={t('tracking.stopNumber', { number: tracking.stops_remaining_before + 1 })} />
              <Info label={t('tracking.stopsBefore')} value={t('tracking.stopCount', { count: tracking.stops_remaining_before })} />
              <Info label={t('tracking.eta')} value={tracking.estimated_arrival_minutes === null ? t('tracking.pendingEta') : tracking.estimated_arrival_minutes === 0 ? t('tracking.completedEta') : t('tracking.etaMinutes', { minutes: tracking.estimated_arrival_minutes })} />
            </dl>
            {tracking.order.failure_reason && <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"><strong>{t('tracking.failureReason')}</strong><p className="mt-1">{tracking.order.failure_reason}</p></div>}
            {tracking.order.delivery_note && <div className="mt-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200"><strong>{t('tracking.deliveryNote')}</strong><p className="mt-1">{tracking.order.delivery_note}</p></div>}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-semibold">{t('tracking.driverTitle')}</h2>
            {tracking.driver ? (
              <div className="mt-4 flex items-start gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-teal-100 text-xl dark:bg-teal-950" aria-hidden="true">🚚</span>
                <dl className="min-w-0 flex-1 space-y-3 text-sm">
                  <Info label={t('tracking.driverName')} value={tracking.driver.driver_name} />
                  <Info label={t('tracking.driverPhone')} value={tracking.driver.driver_phone || t('tracking.notAvailable')} />
                  <Info label={t('tracking.vehicle')} value={`${tracking.driver.license_plate} · ${tracking.driver.vehicle_type === 'TRUCK' ? t('tracking.truck') : tracking.driver.vehicle_type}`} />
                  {tracking.driver.driver_phone?.includes('*') && <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{t('tracking.phoneProtected')}</p>}
                  {tracking.driver.driver_phone && !tracking.driver.driver_phone.includes('*') && <a href={`tel:${tracking.driver.driver_phone}`} className="inline-flex rounded-lg bg-teal-600 px-4 py-2.5 font-semibold text-white hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600">{t('tracking.callDriver')}</a>}
                </dl>
              </div>
            ) : <p className="mt-4 text-sm leading-6 text-slate-500 dark:text-slate-400">{t('tracking.driverPending')}</p>}
          </section>
        </div>
      </div>
    </main>
  );
}

function TrackingProgress({ currentStep, failed }: { currentStep: number; failed: boolean }) {
  const { t } = useI18n();
  return (
    <ol className="mt-7 grid grid-cols-4 gap-1" aria-label={t('tracking.progressLabel')}>
      {stepKeys.map((key, index) => {
        const active = index <= currentStep;
        const terminalFailure = failed && index === 3;
        return (
          <li key={key} className="relative text-center">
            {index > 0 && <span className={`absolute right-1/2 top-3 h-0.5 w-full ${active ? terminalFailure ? 'bg-rose-500' : 'bg-teal-600' : 'bg-slate-200 dark:bg-slate-700'}`} aria-hidden="true" />}
            <span className={`relative mx-auto grid size-6 place-items-center rounded-full border-2 text-[10px] font-bold ${active ? terminalFailure ? 'border-rose-600 bg-rose-600 text-white' : 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900'}`}>{active ? '✓' : index + 1}</span>
            <span className={`mt-2 block text-[10px] font-medium leading-4 sm:text-xs ${active ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{t(failed && index === 3 ? 'tracking.stepFailed' : key)}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 leading-6 text-slate-800 dark:text-slate-200">{value}</dd></div>;
}

function TrackingState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <main className="grid min-h-screen place-items-center bg-slate-50 px-4 dark:bg-slate-950"><section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900"><span className="mx-auto grid size-14 place-items-center rounded-xl bg-teal-100 text-2xl dark:bg-teal-950" aria-hidden="true">📦</span><h1 className="mt-5 text-xl font-semibold text-slate-950 dark:text-white">{title}</h1><p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>{action && <div className="mt-5">{action}</div>}</section></main>;
}
