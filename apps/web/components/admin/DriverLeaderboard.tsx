'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useDepot } from '@/context/DepotContext';
import { useI18n } from '@/context/I18nContext';
import { DriverPerformancePodium } from './DriverPerformancePodium';
import { DriverPerformanceTable } from './DriverPerformanceTable';
import { requestApi } from './api-contracts';
import {
  isDriverPerformanceResponse,
  PERFORMANCE_PERIODS,
  type DriverPerformanceResponse,
  type PerformancePeriod,
} from './driver-performance-contracts';
import { downloadDriverPerformanceCsv } from './driver-performance-export';
import { subscribeToDataInvalidated } from './orders-sync';

function DownloadIcon() {
  return (
    <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" />
    </svg>
  );
}

export function DriverLeaderboard() {
  const { locale, t } = useI18n();
  const { selectedDepot, isLoading: isDepotLoading } = useDepot();
  const [period, setPeriod] = useState<PerformancePeriod>(30);
  const [performance, setPerformance] = useState<DriverPerformanceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const numberLocale = locale === 'vi' ? 'vi-VN' : 'en-US';
  const decimal = useMemo(
    () => new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 1 }),
    [numberLocale],
  );

  const loadPerformance = useCallback(async (signal?: AbortSignal) => {
    if (isDepotLoading) return;
    setIsLoading(true);
    const searchParams = new URLSearchParams({ days: String(period) });
    if (selectedDepot?.id) searchParams.set('depot_id', selectedDepot.id);
    try {
      const payload = await requestApi(
        `/api/v1/admin/drivers/performance?${searchParams.toString()}`,
        { signal },
      );
      if (!isDriverPerformanceResponse(payload)) {
        throw new Error(t('leaderboard.invalidData'));
      }
      setPerformance(payload);
      setError(null);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
      setError(
        requestError instanceof Error
          ? requestError.message
          : t('leaderboard.loadError'),
      );
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [isDepotLoading, period, selectedDepot?.id, t]);

  useEffect(() => {
    if (isDepotLoading) return undefined;
    const controller = new AbortController();
    void loadPerformance(controller.signal);
    const unsubscribe = subscribeToDataInvalidated(
      ['orders', 'fleet', 'driver', 'analytics'],
      () => void loadPerformance(),
    );
    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [isDepotLoading, loadPerformance]);

  const exportCsv = () => {
    if (!performance?.drivers.length) return;
    downloadDriverPerformanceCsv(performance.drivers, {
      rank: t('leaderboard.csv.rank'),
      driver: t('leaderboard.csv.driver'),
      email: t('leaderboard.csv.email'),
      phone: t('leaderboard.csv.phone'),
      vehicle: t('leaderboard.csv.vehicle'),
      orders: t('leaderboard.csv.orders'),
      delivered: t('leaderboard.csv.delivered'),
      failed: t('leaderboard.csv.failed'),
      successRate: t('leaderboard.csv.successRate'),
      adherence: t('leaderboard.csv.adherence'),
      distance: t('leaderboard.csv.distance'),
      co2Saved: t('leaderboard.csv.co2Saved'),
      tier: t('leaderboard.csv.tier'),
      score: t('leaderboard.csv.score'),
      ecoDriver: t('leaderboard.csv.ecoDriver'),
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-sm border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-950 dark:text-white">{t('leaderboard.periodTitle')}</p>
          <div className="mt-2 inline-flex rounded-sm bg-slate-100 p-1 dark:bg-slate-950" aria-label={t('leaderboard.periodSelector')}>
            {PERFORMANCE_PERIODS.map((days) => (
              <button
                className={`rounded-sm px-3 py-2 text-sm font-semibold transition ${
                  period === days
                    ? 'bg-amber-700 dark:bg-amber-400 text-white dark:text-slate-950'
                    : 'text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'
                }`}
                aria-pressed={period === days}
                key={days}
                type="button"
                onClick={() => setPeriod(days)}
              >
                {t('leaderboard.periodDays', { days })}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {performance && (
            <div className="rounded-sm bg-emerald-50 px-4 py-2 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200" aria-live="polite">
              <span className="font-semibold">{decimal.format(performance.total_co2_saved_all_kg)} kg</span>{' '}
              {t('leaderboard.totalCo2')}
              <span aria-hidden="true"> · </span>
              {t('leaderboard.totalDrivers', { count: performance.drivers.length })}
            </div>
          )}
          <button
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-sm border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-amber-500 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-amber-500 dark:hover:text-amber-300"
            disabled={!performance?.drivers.length}
            type="button"
            onClick={exportCsv}
          >
            <DownloadIcon />
            {t('leaderboard.exportCsv')}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex flex-col gap-3 rounded-sm border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <span>{error}</span>
          <button className="font-semibold underline underline-offset-4" type="button" onClick={() => void loadPerformance()}>
            {t('leaderboard.retry')}
          </button>
        </div>
      )}

      {!performance && isLoading ? (
        <div className="space-y-5" aria-busy="true" aria-label={t('leaderboard.loading')}>
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div className="h-64 animate-pulse rounded-sm bg-slate-200/70 dark:bg-slate-800" key={index} />
            ))}
          </div>
          <div className="h-96 animate-pulse rounded-sm bg-slate-200/70 dark:bg-slate-800" />
        </div>
      ) : performance?.drivers.length ? (
        <div className={`space-y-7 transition-opacity ${isLoading ? 'opacity-60' : ''}`}>
          <DriverPerformancePodium drivers={performance.drivers} />
          <DriverPerformanceTable drivers={performance.drivers} />
        </div>
      ) : (
        <div className="grid min-h-64 place-items-center rounded-sm border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900" role="status">
          <div>
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-50 text-xl dark:bg-emerald-950" aria-hidden="true">🌱</span>
            <h2 className="mt-3 font-bold text-slate-950 dark:text-white text-base uppercase tracking-[0.14em]">{t('leaderboard.emptyTitle')}</h2>
            <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{t('leaderboard.emptyDescription')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
