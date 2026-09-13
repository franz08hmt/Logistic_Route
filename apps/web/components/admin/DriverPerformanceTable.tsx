'use client';

import { useI18n } from '@/context/I18nContext';
import type {
  DriverPerformanceItem,
  PerformanceTier,
} from './driver-performance-contracts';

const TIER_STYLES: Record<PerformanceTier, string> = {
  GOLD: 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200',
  SILVER: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
  BRONZE: 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200',
};

export function DriverPerformanceTable({
  drivers,
}: {
  drivers: DriverPerformanceItem[];
}) {
  const { locale, t } = useI18n();
  const numberLocale = locale === 'vi' ? 'vi-VN' : 'en-US';
  const decimal = new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 1 });

  return (
    <section className="overflow-hidden rounded-sm border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" aria-labelledby="performance-ranking-title">
      <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
          {t('leaderboard.rankingEyebrow')}
        </p>
        <h2 className="mt-1 font-bold text-slate-950 dark:text-white text-base uppercase tracking-[0.14em]" id="performance-ranking-title">
          {t('leaderboard.rankingTitle')}
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[72rem] border-collapse text-left text-sm">
          <caption className="sr-only">{t('leaderboard.tableCaption')}</caption>
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/70 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-semibold" scope="col">{t('leaderboard.rank')}</th>
              <th className="px-5 py-3 font-semibold" scope="col">{t('leaderboard.driverVehicle')}</th>
              <th className="px-5 py-3 font-semibold" scope="col">{t('leaderboard.successRate')}</th>
              <th className="px-5 py-3 font-semibold" scope="col">{t('leaderboard.adherence')}</th>
              <th className="px-5 py-3 font-semibold" scope="col">{t('leaderboard.co2Saved')}</th>
              <th className="px-5 py-3 font-semibold" scope="col">{t('leaderboard.tier')}</th>
              <th className="px-5 py-3 text-right font-semibold" scope="col">{t('leaderboard.score')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {drivers.map((driver) => (
              <tr className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50" key={driver.driver_id}>
                <td className="px-5 py-4">
                  <span className="grid size-9 place-items-center rounded-full bg-slate-100 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {driver.rank}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-50 font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      {driver.driver_name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-950 dark:text-white">{driver.driver_name}</p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {driver.phone_number ?? t('leaderboard.noPhone')}
                        <span aria-hidden="true"> · </span>
                        {driver.license_plate ?? t('leaderboard.noVehicle')}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <progress className="h-2 w-24 accent-amber-600" max="100" value={driver.success_rate} aria-label={t('leaderboard.successRate')} />
                    <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-200">{decimal.format(driver.success_rate)}%</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{driver.delivered_count}/{driver.total_orders_handled}</p>
                </td>
                <td className="px-5 py-4 font-medium tabular-nums text-slate-800 dark:text-slate-200">
                  {decimal.format(driver.route_adherence_score)}%
                </td>
                <td className="px-5 py-4">
                  <span className="font-medium tabular-nums text-emerald-700 dark:text-emerald-300">
                    {decimal.format(driver.estimated_co2_saved_kg)} kg
                  </span>
                  {driver.is_eco_driver && (
                    <span className="mt-1 flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                      <span aria-hidden="true">🌱</span>{t('leaderboard.ecoDriver')}
                    </span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${TIER_STYLES[driver.tier_badge]}`}>
                    {t(`leaderboard.tier.${driver.tier_badge}`)}
                  </span>
                </td>
                <td className="px-5 py-4 text-right text-lg font-bold tabular-nums text-slate-950 dark:text-white">
                  {decimal.format(driver.overall_score)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
