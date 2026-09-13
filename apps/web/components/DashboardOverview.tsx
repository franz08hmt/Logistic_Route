'use client';

import { useEffect, useState } from 'react';

import { useI18n } from '@/context/I18nContext';
import { useDepot } from '@/context/DepotContext';
import { apiFetch } from '@/lib/api-client';
import { withDepotQuery } from './depot-contracts';
import type { TranslationKey } from '@/lib/i18n/i18n';
import {
  subscribeToDataInvalidated,
  subscribeToOrdersUpdated,
} from './admin/orders-sync';
import { SectionLabel, StatStrip, StatTile, type StatTileTone } from './ui/StatTile';

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
  { labelKey: 'dashboard.activeOrders', key: 'active_orders_count', tone: 'accent', helperKey: 'dashboard.activeOrdersHelper' },
  { labelKey: 'dashboard.deliveredOrders', key: 'delivered_orders_count', tone: 'positive', helperKey: 'dashboard.deliveredOrdersHelper' },
  { labelKey: 'dashboard.vehicles', key: 'vehicles_count', tone: 'info', helperKey: 'dashboard.vehiclesHelper' },
  { labelKey: 'dashboard.driversOnline', key: 'drivers_online_count', tone: 'warning', helperKey: 'dashboard.driversOnlineHelper' },
] satisfies Array<{
  labelKey: TranslationKey;
  key: keyof Overview;
  tone: StatTileTone;
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
          <div key={index} className="console-panel h-36 animate-pulse rounded-sm" />
        ))}
      </div>
      <div className="console-panel h-28 animate-pulse rounded-sm" />
    </div>
  );
}

export function DashboardOverview() {
  const { locale, t } = useI18n();
  const { selectedDepot } = useDepot();
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
        const response = await apiFetch(withDepotQuery('/api/v1/overview', selectedDepot?.id ?? null), {
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
  }, [selectedDepot?.id]);

  if (!overview && !hasError) {
    return <DashboardSkeleton label={t('dashboard.loading')} />;
  }

  return (
    <div className="space-y-5">
      {hasError && (
        <p className="rounded-sm border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300" role="alert">
          {t('dashboard.loadError')}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={t('dashboard.liveMetrics')}>
        {primaryMetrics.map((metric) => (
          <StatTile
            key={metric.key}
            tone={metric.tone}
            label={t(metric.labelKey)}
            value={overview?.[metric.key] ?? '—'}
            hint={t(metric.helperKey)}
          />
        ))}
      </div>

      <section aria-label={t('dashboard.routingMetrics')}>
        <StatStrip
          items={secondaryMetrics.map((metric) => ({
            label: t(metric.labelKey),
            value: overview?.[metric.key] ?? '—',
          }))}
        />
      </section>

      <section className="rounded-sm border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none" aria-labelledby="analytics-title">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <SectionLabel>{t('dashboard.costEyebrow')}</SectionLabel>
            <h2 id="analytics-title" className="mt-1 font-bold text-slate-950 dark:text-white text-base uppercase tracking-[0.14em]">{t('dashboard.costTitle')}</h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">{t('dashboard.costNote')}</span>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <article className="rounded-sm bg-slate-50 p-4 dark:bg-slate-950/60">
            <span className="text-sm text-slate-600 dark:text-slate-400">{t('dashboard.operatingCost')}</span>
            <strong className="mt-2 block text-2xl font-extrabold tabular-nums text-slate-950 dark:text-white">
              {overview ? currencyFormatter.format(overview.estimated_operating_cost_vnd) : '—'}
            </strong>
            <small className="mt-1 block text-xs font-medium text-emerald-700 dark:text-emerald-400">
              {t('dashboard.aiSavings', { amount: overview ? currencyFormatter.format(overview.estimated_savings_vnd) : '—' })}
            </small>
          </article>
          <article className="rounded-sm bg-slate-50 p-4 dark:bg-slate-950/60">
            <span className="text-sm text-slate-600 dark:text-slate-400">{t('dashboard.co2Savings')}</span>
            <strong className="mt-2 block text-2xl font-extrabold tabular-nums text-slate-950 dark:text-white">
              {overview ? `${decimalFormatter.format(overview.estimated_co2_savings_kg)} kg` : '—'}
            </strong>
            <small className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
              {t('dashboard.co2Baseline', { amount: overview ? decimalFormatter.format(overview.co2_emissions_kg) : '—' })}
            </small>
          </article>
        </div>
      </section>

      <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
        <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
        {t('dashboard.liveSource')}
      </p>
    </div>
  );
}
