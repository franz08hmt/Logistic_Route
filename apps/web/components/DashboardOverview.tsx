'use client';

import { useEffect, useState } from 'react';

import { useI18n } from '@/context/I18nContext';
import { apiFetch } from '@/lib/api-client';
import type { TranslationKey } from '@/lib/i18n/i18n';
import {
  subscribeToDataInvalidated,
  subscribeToOrdersUpdated,
} from './admin/orders-sync';

type Overview = {
  active_orders_count: number;
  assigned_orders_count: number;
  delivered_orders_count: number;
  failed_orders_count: number;
  vehicles_count: number;
  drivers_online_count: number;
  routes_optimized_count: number;
  estimated_operating_cost_vnd: number;
  estimated_savings_vnd: number;
  co2_emissions_kg: number;
  estimated_co2_savings_kg: number;
};

const primaryMetrics = [
  { labelKey: 'dashboard.activeOrders', key: 'active_orders_count', marker: 'bg-teal-500', helperKey: 'dashboard.activeOrdersHelper' },
  { labelKey: 'dashboard.deliveredOrders', key: 'delivered_orders_count', marker: 'bg-emerald-500', helperKey: 'dashboard.deliveredOrdersHelper' },
  { labelKey: 'dashboard.vehicles', key: 'vehicles_count', marker: 'bg-sky-500', helperKey: 'dashboard.vehiclesHelper' },
  { labelKey: 'dashboard.driversOnline', key: 'drivers_online_count', marker: 'bg-amber-500', helperKey: 'dashboard.driversOnlineHelper' },
] satisfies Array<{
  labelKey: TranslationKey;
  key: keyof Overview;
  marker: string;
  helperKey: TranslationKey;
}>;

const secondaryMetrics = [
  { labelKey: 'dashboard.assignedOrders', key: 'assigned_orders_count' },
  { labelKey: 'dashboard.failedOrders', key: 'failed_orders_count' },
  { labelKey: 'dashboard.optimizedStops', key: 'routes_optimized_count' },
] satisfies Array<{ labelKey: TranslationKey; key: keyof Overview }>;

function DashboardSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-5" aria-label={label} aria-busy="true">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
        ))}
      </div>
      <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
    </div>
  );
}

export function DashboardOverview() {
  const { locale, t } = useI18n();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [hasError, setHasError] = useState(false);
  const numberLocale = locale === 'vi' ? 'vi-VN' : 'en-US';
  const currencyFormatter = new Intl.NumberFormat(numberLocale, {
    maximumFractionDigits: 0,
    style: 'currency',
    currency: 'VND',
  });
  const decimalFormatter = new Intl.NumberFormat(numberLocale, {
    maximumFractionDigits: 2,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadOverview() {
      try {
        const response = await apiFetch('/api/v1/overview', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }
        setOverview((await response.json()) as Overview);
        setHasError(false);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') {
          return;
        }
        setHasError(true);
      }
    }

    void loadOverview();
    const refreshInterval = window.setInterval(() => {
      void loadOverview();
    }, 10_000);
    const unsubscribeOrders = subscribeToOrdersUpdated(() => {
      void loadOverview();
    });
    const unsubscribeInvalidation = subscribeToDataInvalidated(
      ['overview'],
      () => void loadOverview(),
    );

    return () => {
      controller.abort();
      window.clearInterval(refreshInterval);
      unsubscribeOrders();
      unsubscribeInvalidation();
    };
  }, []);

  if (!overview && !hasError) {
    return <DashboardSkeleton label={t('dashboard.loading')} />;
  }

  return (
    <div className="space-y-5">
      {hasError && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300" role="alert">
          {t('dashboard.loadError')}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={t('dashboard.liveMetrics')}>
        {primaryMetrics.map((metric) => (
          <article key={metric.key} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{t(metric.labelKey)}</span>
              <span className={`size-2.5 rounded-full ${metric.marker}`} aria-hidden="true" />
            </div>
            <strong className="mt-4 block text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
              {overview?.[metric.key] ?? '—'}
            </strong>
            <small className="mt-1 block text-xs text-slate-500">{t(metric.helperKey)}</small>
          </article>
        ))}
      </div>

      <section className="grid overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-3" aria-label={t('dashboard.routingMetrics')}>
        {secondaryMetrics.map((metric, index) => (
          <article key={metric.key} className={`flex items-center justify-between gap-3 px-5 py-4 ${index > 0 ? 'border-t border-slate-200 dark:border-slate-800 sm:border-l sm:border-t-0' : ''}`}>
            <span className="text-sm text-slate-600 dark:text-slate-400">{t(metric.labelKey)}</span>
            <strong className="text-lg text-slate-950 dark:text-white">{overview?.[metric.key] ?? '—'}</strong>
          </article>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none" aria-labelledby="analytics-title">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-400">{t('dashboard.costEyebrow')}</p>
            <h2 id="analytics-title" className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{t('dashboard.costTitle')}</h2>
          </div>
          <span className="text-xs text-slate-500">{t('dashboard.costNote')}</span>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <article className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950/60">
            <span className="text-sm text-slate-600 dark:text-slate-400">{t('dashboard.operatingCost')}</span>
            <strong className="mt-2 block text-2xl font-semibold text-slate-950 dark:text-white">
              {overview ? currencyFormatter.format(overview.estimated_operating_cost_vnd) : '—'}
            </strong>
            <small className="mt-1 block text-xs font-medium text-emerald-700 dark:text-emerald-400">
              {t('dashboard.aiSavings', { amount: overview ? currencyFormatter.format(overview.estimated_savings_vnd) : '—' })}
            </small>
          </article>
          <article className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950/60">
            <span className="text-sm text-slate-600 dark:text-slate-400">{t('dashboard.co2Savings')}</span>
            <strong className="mt-2 block text-2xl font-semibold text-slate-950 dark:text-white">
              {overview ? `${decimalFormatter.format(overview.estimated_co2_savings_kg)} kg` : '—'}
            </strong>
            <small className="mt-1 block text-xs text-slate-500">
              {t('dashboard.co2Baseline', { amount: overview ? decimalFormatter.format(overview.co2_emissions_kg) : '—' })}
            </small>
          </article>
        </div>
      </section>

      <p className="flex items-center gap-2 text-xs text-slate-500" aria-live="polite">
        <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
        {t('dashboard.liveSource')}
      </p>
    </div>
  );
}
