'use client';

import { useI18n } from '@/context/I18nContext';
import type { DriverPerformanceItem } from './driver-performance-contracts';

const RANK_PRESENTATION = {
  1: {
    medal: '👑',
    card: 'border-amber-300 bg-amber-50/70 dark:border-amber-700 dark:bg-amber-950/20 sm:order-2 sm:-translate-y-4',
    avatar: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  },
  2: {
    medal: '🥈',
    card: 'border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900 sm:order-1',
    avatar: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100',
  },
  3: {
    medal: '🥉',
    card: 'border-orange-300 bg-orange-50/70 dark:border-orange-800 dark:bg-orange-950/20 sm:order-3',
    avatar: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  },
} as const;

export function DriverPerformancePodium({
  drivers,
}: {
  drivers: DriverPerformanceItem[];
}) {
  const { locale, t } = useI18n();
  const decimal = new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    maximumFractionDigits: 1,
  });

  return (
    <section aria-labelledby="performance-podium-title">
      <div className="mb-8 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">
            {t('leaderboard.podiumEyebrow')}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white" id="performance-podium-title">
            {t('leaderboard.podiumTitle')}
          </h2>
        </div>
      </div>
      <ol className="grid gap-4 sm:grid-cols-3 sm:items-end">
        {drivers.slice(0, 3).map((driver) => {
          const presentation = RANK_PRESENTATION[driver.rank as 1 | 2 | 3];
          return (
            <li
              className={`rounded-xl border p-5 text-center shadow-sm transition-transform ${presentation.card}`}
              key={driver.driver_id}
            >
              <span className="text-3xl" aria-hidden="true">{presentation.medal}</span>
              <span className="sr-only">{t('leaderboard.rankLabel', { rank: driver.rank })}</span>
              <span className={`mx-auto mt-3 grid size-14 place-items-center rounded-full text-lg font-bold ${presentation.avatar}`}>
                {driver.driver_name.charAt(0).toUpperCase()}
              </span>
              <h3 className="mt-3 truncate font-semibold text-slate-950 dark:text-white">
                {driver.driver_name}
              </h3>
              <p className="mt-1 truncate text-xs text-slate-500">
                {driver.license_plate ?? t('leaderboard.noVehicle')}
              </p>
              <strong className="mt-4 block text-3xl tracking-tight text-slate-950 dark:text-white">
                {decimal.format(driver.overall_score)}
              </strong>
              <span className="text-xs font-medium text-slate-500">{t('leaderboard.score')}</span>
              <dl className="mt-4 grid grid-cols-2 divide-x divide-slate-200 border-t border-slate-200 pt-3 text-sm dark:divide-slate-700 dark:border-slate-700">
                <div>
                  <dt className="text-xs text-slate-500">{t('leaderboard.delivered')}</dt>
                  <dd className="mt-1 font-semibold text-slate-900 dark:text-white">{driver.delivered_count}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">{t('leaderboard.co2Saved')}</dt>
                  <dd className="mt-1 font-semibold text-emerald-700 dark:text-emerald-300">
                    {decimal.format(driver.estimated_co2_saved_kg)} kg
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
