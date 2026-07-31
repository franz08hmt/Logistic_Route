'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useI18n } from '@/context/I18nContext';
import { requestApi } from '@/components/admin/api-contracts';
import { subscribeToDataInvalidated } from '@/components/admin/orders-sync';
import {
  isAnalyticsHistory,
  type AnalyticsHistoryResponse,
} from './analytics-contracts';
import { downloadAnalyticsCsv } from './analytics-export';

const AnalyticsCharts = dynamic(() => import('./AnalyticsCharts'), {
  ssr: false,
  loading: () => (
    <div className="grid gap-5 lg:grid-cols-2" aria-busy="true">
      <div className="h-96 animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800 lg:col-span-2" />
      <div className="h-96 animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800" />
      <div className="h-96 animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800" />
    </div>
  ),
});

const PERIODS = [7, 14, 30] as const;
type Period = (typeof PERIODS)[number];

function DownloadIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" />
    </svg>
  );
}

export function AnalyticsDashboard() {
  const { locale, t } = useI18n();
  const [period, setPeriod] = useState<Period>(30);
  const [history, setHistory] = useState<AnalyticsHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const numberLocale = locale === 'vi' ? 'vi-VN' : 'en-US';

  const currency = useMemo(() => new Intl.NumberFormat(numberLocale, {
    maximumFractionDigits: 0,
    style: 'currency',
    currency: 'VND',
  }), [numberLocale]);
  const decimal = useMemo(() => new Intl.NumberFormat(numberLocale, {
    maximumFractionDigits: 1,
  }), [numberLocale]);
  const integer = useMemo(() => new Intl.NumberFormat(numberLocale, {
    maximumFractionDigits: 0,
  }), [numberLocale]);
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(numberLocale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }), [numberLocale]);

  const loadHistory = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    try {
      const payload = await requestApi(
        `/api/v1/analytics/history?days=${period}&group_by=day`,
        { signal },
      );
      if (!isAnalyticsHistory(payload)) {
        throw new Error(t('analytics.invalidData'));
      }
      setHistory(payload);
      setError(null);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') {
        return;
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : t('analytics.loadError'),
      );
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, [period, t]);

  useEffect(() => {
    const controller = new AbortController();
    void loadHistory(controller.signal);
    const unsubscribe = subscribeToDataInvalidated(
      ['analytics'],
      () => void loadHistory(),
    );
    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [loadHistory]);

  const downloadCsv = () => {
    if (!history?.data_points.length) {
      return;
    }
    downloadAnalyticsCsv(history.data_points, {
      date: t('analytics.tableDate'),
      distance: t('analytics.csvDistance'),
      duration: t('analytics.csvDuration'),
      fuelCost: t('analytics.csvFuelCost'),
      driverCost: t('analytics.csvDriverCost'),
      totalCost: t('analytics.csvTotalCost'),
      savings: t('analytics.csvSavings'),
      co2: t('analytics.csvCo2'),
      co2Saved: t('analytics.csvCo2Saved'),
      runs: t('analytics.tableRuns'),
    });
  };

  const summaryCards = history ? [
    {
      label: t('analytics.kpiRuns'),
      value: integer.format(history.summary.total_optimizations),
      helper: t('analytics.kpiRunsHelper', { days: period }),
      marker: 'bg-teal-500',
    },
    {
      label: t('analytics.kpiTotalCost'),
      value: currency.format(history.summary.total_cost_vnd),
      helper: t('analytics.kpiCostHelper'),
      marker: 'bg-sky-500',
    },
    {
      label: t('analytics.kpiSavings'),
      value: currency.format(history.summary.total_savings_vnd),
      helper: t('analytics.kpiSavingsHelper', {
        rate: integer.format(history.summary.avg_savings_rate * 100),
      }),
      marker: 'bg-emerald-500',
    },
    {
      label: t('analytics.kpiCo2'),
      value: `${decimal.format(history.summary.total_co2_saved_kg)} kg`,
      helper: history.summary.best_day
        ? t('analytics.kpiBestDay', {
          date: dateFormatter.format(
            new Date(`${history.summary.best_day}T00:00:00Z`),
          ),
        })
        : t('analytics.kpiNoBestDay'),
      marker: 'bg-lime-500',
    },
  ] : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-fit rounded-lg bg-slate-100 p-1 dark:bg-slate-950" aria-label={t('analytics.periodSelector')}>
          {PERIODS.map((days) => (
            <button
              key={days}
              type="button"
              className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                period === days
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'
              }`}
              aria-pressed={period === days}
              onClick={() => setPeriod(days)}
            >
              {t('analytics.periodDays', { days })}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-teal-500 dark:hover:text-teal-300"
          disabled={!history?.data_points.length}
          onClick={downloadCsv}
        >
          <DownloadIcon />
          {t('analytics.exportCsv')}
        </button>
      </div>

      {error && (
        <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <span>{error}</span>
          <button type="button" className="font-semibold underline underline-offset-4" onClick={() => void loadHistory()}>
            {t('analytics.retry')}
          </button>
        </div>
      )}

      {!history && isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={t('analytics.loading')} aria-busy="true">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800" />
          ))}
        </div>
      ) : history ? (
        <>
          <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 ${isLoading ? 'opacity-70' : ''}`} aria-live="polite">
            {summaryCards.map((card) => (
              <article key={card.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{card.label}</span>
                  <span className={`size-2.5 shrink-0 rounded-full ${card.marker}`} aria-hidden="true" />
                </div>
                <strong className="mt-4 block break-words text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                  {card.value}
                </strong>
                <small className="mt-1 block text-xs text-slate-500">{card.helper}</small>
              </article>
            ))}
          </div>

          {history.data_points.length ? (
            <>
              <AnalyticsCharts
                data={history.data_points}
                locale={locale}
                labels={{
                  costTitle: t('analytics.costChartTitle'),
                  costDescription: t('analytics.costChartDescription'),
                  fuelCost: t('analytics.fuelCost'),
                  driverCost: t('analytics.driverCost'),
                  distanceTitle: t('analytics.distanceChartTitle'),
                  distanceDescription: t('analytics.distanceChartDescription'),
                  distance: t('analytics.distance'),
                  co2Title: t('analytics.co2ChartTitle'),
                  co2Description: t('analytics.co2ChartDescription'),
                  co2Saved: t('analytics.co2Saved'),
                }}
              />

              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
                <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                  <h2 className="font-semibold text-slate-950 dark:text-white">{t('analytics.tableTitle')}</h2>
                  <p className="mt-1 text-sm text-slate-500">{t('analytics.tableDescription')}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/60">
                      <tr>
                        <th className="px-5 py-3 font-semibold">{t('analytics.tableDate')}</th>
                        <th className="px-5 py-3 font-semibold">{t('analytics.tableRuns')}</th>
                        <th className="px-5 py-3 font-semibold">{t('analytics.tableDistance')}</th>
                        <th className="px-5 py-3 font-semibold">{t('analytics.tableDuration')}</th>
                        <th className="px-5 py-3 font-semibold">{t('analytics.tableCost')}</th>
                        <th className="px-5 py-3 font-semibold">{t('analytics.tableSavings')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {[...history.data_points].reverse().map((point) => (
                        <tr key={point.date} className="text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-950/40">
                          <td className="whitespace-nowrap px-5 py-3 font-medium text-slate-950 dark:text-white">
                            {dateFormatter.format(new Date(`${point.date}T00:00:00Z`))}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3">{integer.format(point.optimization_runs)}</td>
                          <td className="whitespace-nowrap px-5 py-3">{decimal.format(point.total_distance_km)} km</td>
                          <td className="whitespace-nowrap px-5 py-3">{decimal.format(point.total_duration_mins)}</td>
                          <td className="whitespace-nowrap px-5 py-3">{currency.format(point.total_cost_vnd)}</td>
                          <td className="whitespace-nowrap px-5 py-3 font-medium text-emerald-700 dark:text-emerald-400">
                            {currency.format(point.estimated_savings_vnd)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : (
            <section className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900">
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-teal-50 text-xl dark:bg-teal-950">↗</div>
              <h2 className="mt-4 font-semibold text-slate-950 dark:text-white">{t('analytics.emptyTitle')}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{t('analytics.emptyDescription')}</p>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}
