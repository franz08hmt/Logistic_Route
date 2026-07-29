'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useI18n } from '@/context/I18nContext';

import { isOrderList, requestApi, type Order } from '../admin/api-contracts';
import { publishOrdersUpdated } from '../admin/orders-sync';
import { downloadManifestCsv } from './manifest-export';
import { getOptimizationSuccessMessage } from './optimization-feedback';
import { RouteCostSummary } from './RouteCostSummary';
import { RouteListPanel } from './RouteListPanel';
import { isOptimizationResult, type OptimizationResult } from './types';

const RouteMap = dynamic(
  () => import('./RouteMap').then((module) => module.RouteMap),
  {
    ssr: false,
    loading: MapLoadingFallback,
  },
);

function MapLoadingFallback() {
  const { t } = useI18n();
  return (
    <div
      className="grid h-full min-h-[42rem] place-items-center bg-slate-200 dark:bg-slate-900"
      aria-label={t('map.loadingLabel')}
      aria-busy="true"
    >
      <div className="text-center">
        <span className="mx-auto block size-8 animate-spin rounded-full border-2 border-slate-400 border-t-teal-600" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
          {t('map.loading')}
        </p>
      </div>
    </div>
  );
}

export function RouteOptimizationPanel() {
  const { locale, t } = useI18n();
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    let active = true;

    async function loadOrders() {
      try {
        const payload = await requestApi('/api/v1/orders');
        if (active && isOrderList(payload)) {
          setOrders(payload);
        }
      } catch {
        // The map remains useful if this background refresh fails.
      }
    }

    void loadOrders();
    const refreshInterval = window.setInterval(() => void loadOrders(), 10000);
    return () => {
      active = false;
      window.clearInterval(refreshInterval);
    };
  }, []);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => setToastMessage(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [toastMessage]);

  async function optimizeRoutes() {
    setIsLoading(true);
    setError(null);

    try {
      const payload = await requestApi('/api/v1/routes/optimize', {
        method: 'POST',
      });
      if (!isOptimizationResult(payload)) {
        throw new Error(t('map.invalidResult'));
      }

      setResult(payload);
      const assignedOrderCount = payload.routes.reduce(
        (total, route) => total + route.stops.length,
        0,
      );
      setToastMessage(getOptimizationSuccessMessage(assignedOrderCount, locale));

      try {
        const ordersPayload = await requestApi('/api/v1/orders');
        if (!isOrderList(ordersPayload)) {
          throw new Error('API returned an invalid order list after optimization');
        }
        setOrders(ordersPayload);
        publishOrdersUpdated(ordersPayload);
      } catch {
        setError(
          t('map.syncError'),
        );
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t('map.optimizeError'),
      );
    } finally {
      setIsLoading(false);
    }
  }

  const assignedStops =
    result?.routes.reduce((total, route) => total + route.stops.length, 0) ?? 0;

  function exportManifest() {
    if (!result || result.routes.length === 0) {
      return;
    }

    downloadManifestCsv(result, orders);
    setToastMessage(t('map.exportSuccess'));
  }
  const numberFormatter = new Intl.NumberFormat(
    locale === 'vi' ? 'vi-VN' : 'en-US',
    { maximumFractionDigits: 1 },
  );

  return (
    <section className="relative h-[calc(100dvh-8rem)] min-h-[42rem] overflow-hidden bg-slate-200 dark:bg-slate-900 lg:h-screen lg:min-h-[44rem]">
      <h1 className="sr-only">{t('map.title')}</h1>
      <RouteMap result={result} orders={orders} />

      {toastMessage && (
        <div
          className="absolute left-1/2 top-3 z-[700] flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-xl border border-emerald-200 bg-white/95 px-4 py-3 text-sm font-medium text-emerald-800 shadow-xl backdrop-blur dark:border-emerald-900 dark:bg-slate-900/95 dark:text-emerald-300"
          role="status"
          aria-live="polite"
        >
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-600 text-xs text-white" aria-hidden="true">✓</span>
          <p className="flex-1">{toastMessage}</p>
          <button type="button" onClick={() => setToastMessage(null)} aria-label={t('common.closeNotification')} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            ×
          </button>
        </div>
      )}

      <header className="absolute inset-x-3 top-3 z-[600] rounded-2xl border border-white/70 bg-white/90 p-3 shadow-xl shadow-slate-900/10 backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-950/90 sm:p-4 lg:left-4 lg:right-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="min-w-0 xl:flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-400">{t('map.control')}</p>
            <h2 className="mt-1 text-base font-bold text-slate-950 dark:text-white sm:text-lg">{t('map.optimizeTitle')}</h2>
            <p className="mt-1 hidden text-xs text-slate-500 sm:block">
              {t('map.optimizeDescription')}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2" aria-live="polite">
            <Metric label={t('map.distance')} value={result ? `${numberFormatter.format(result.total_distance_km)} km` : '—'} />
            <Metric label={t('map.duration')} value={result ? `${numberFormatter.format(result.total_duration_mins)} ${t('map.minutes')}` : '—'} />
            <Metric label={t('map.vehicles')} value={result?.routes.length ?? '—'} />
            <Metric label={t('map.deliveryStops')} value={result ? assignedStops : '—'} />
          </div>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 text-sm font-bold text-white shadow-lg shadow-teal-700/20 transition hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-60"
            type="button"
            onClick={optimizeRoutes}
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading && <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
            {isLoading ? t('map.optimizing') : `⚡ ${t('map.optimize')}`}
          </button>
        </div>
      </header>

      {error && (
        <p className="absolute inset-x-3 top-48 z-[650] rounded-xl border border-red-200 bg-white/95 px-4 py-3 text-sm text-red-700 shadow-lg backdrop-blur dark:border-red-900 dark:bg-slate-950/95 dark:text-red-300 sm:top-36 lg:left-[26rem] lg:right-4" role="alert">
          {error}
        </p>
      )}

      <aside className="absolute inset-x-3 bottom-3 z-[500] flex max-h-[44%] flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-2xl shadow-slate-900/15 backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-950/95 sm:bottom-4 md:bottom-4 md:left-4 md:right-auto md:top-40 md:max-h-none md:w-96 lg:top-36">
        <RouteListPanel result={result} />
        <RouteCostSummary result={result} onExport={exportManifest} />
      </aside>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-100/80 px-2 py-1.5 dark:bg-slate-800/80 sm:min-w-20">
      <span className="block truncate text-[9px] font-medium text-slate-500 sm:text-[10px]">{label}</span>
      <strong className="mt-0.5 block truncate text-[11px] text-slate-900 dark:text-white sm:text-xs">{value}</strong>
    </div>
  );
}
