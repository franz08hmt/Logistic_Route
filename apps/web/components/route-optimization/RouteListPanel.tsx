import type { OptimizationResult } from './types';
import { useI18n } from '@/context/I18nContext';

export function RouteListPanel({ result }: { result: OptimizationResult | null }) {
  const { locale, t } = useI18n();
  const numberFormatter = new Intl.NumberFormat(
    locale === 'vi' ? 'vi-VN' : 'en-US',
    { maximumFractionDigits: 1 },
  );

  return (
    <section className="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-labelledby="route-list-title">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-400">{t('map.routeListEyebrow')}</p>
          <h2 id="route-list-title" className="mt-1 text-base font-semibold text-slate-950 dark:text-white">{t('map.routeListTitle')}</h2>
        </div>
        {result && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            {result.status}
          </span>
        )}
      </div>

      {!result && (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:border-slate-700">
          {t('map.routeListEmpty')}
        </div>
      )}
      {result?.routes.length === 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:border-slate-700" role="status">
          {t('map.routeListDone')}
        </div>
      )}

      <div className="mt-3 space-y-2">
        {result?.routes.map((route, index) => (
          <details key={route.vehicle_id} className="group overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800" open={index === 0}>
            <summary className="flex list-none items-center justify-between gap-3 px-3.5 py-3 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-teal-600">
              <span>
                <small className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('map.vehicleIndex', { index: index + 1 })}</small>
                <strong className="mt-0.5 block text-sm text-slate-950 dark:text-white">{route.license_plate}</strong>
              </span>
              <span className="text-right">
                <strong className="block text-xs text-slate-700 dark:text-slate-300">{numberFormatter.format(route.distance_km)} km</strong>
                <small className="text-[10px] text-slate-500">{t('map.stopCount', { count: route.stops.length })}</small>
              </span>
            </summary>
            <div className="border-t border-slate-200 bg-slate-50/70 px-3.5 py-3 dark:border-slate-800 dark:bg-slate-950/40">
              <p className="text-xs text-slate-500">{t('map.loadWeight', { weight: numberFormatter.format(route.total_weight_kg) })}</p>
              <ol className="mt-3 space-y-3">
                {route.stops.map((stop) => (
                  <li key={stop.order_id} className="grid grid-cols-[1.5rem_1fr] gap-2.5">
                    <span className="grid size-6 place-items-center rounded-full bg-teal-600 text-[10px] font-bold text-white">{stop.stop_sequence}</span>
                    <p className="pt-0.5 text-xs leading-5 text-slate-700 dark:text-slate-300">{stop.address}</p>
                  </li>
                ))}
              </ol>
            </div>
          </details>
        ))}
      </div>

      {!!result?.unassigned_orders.length && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300" role="status">
          <strong>{t('map.unassigned', { count: result.unassigned_orders.length })}</strong>
          <p className="mt-1">{t('map.unassignedHelp')}</p>
        </div>
      )}
    </section>
  );
}
