import type { DriverRoute } from './driver-contracts';
import { useI18n } from '@/context/I18nContext';

export function DriverOverview({
  route,
  driverName,
}: {
  route: DriverRoute;
  driverName: string;
}) {
  const { t } = useI18n();
  const progressPercent =
    route.total_orders === 0
      ? 0
      : Math.round((route.completed_orders / route.total_orders) * 100);

  return (
    <header className="overflow-hidden rounded-2xl bg-gradient-to-br from-teal-700 via-teal-600 to-emerald-600 p-5 text-white shadow-lg shadow-teal-900/15 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-100">
            {t('driver.eyebrow')}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            {t('driver.greeting', { name: driverName })}
          </h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-teal-50/90">
            {t('driver.description')}
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/12 px-4 py-3 backdrop-blur">
          <span className="grid size-10 place-items-center rounded-lg bg-white/15 text-xl" aria-hidden="true">▰</span>
          <span>
            <small className="block text-[10px] font-semibold uppercase tracking-wide text-teal-100">{t('driver.assignedVehicle')}</small>
          <strong className="mt-0.5 block text-lg">{route.vehicle?.license_plate ?? t('driver.awaitingVehicle')}</strong>
          </span>
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-slate-950/20 p-4">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="font-medium text-teal-50">{t('driver.progress')}</span>
          <strong>{t('driver.progressValue', { completed: route.completed_orders, total: route.total_orders, percent: progressPercent })}</strong>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-label={t('driver.progressAria')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}>
          <span className="block h-full rounded-full bg-white transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-3 divide-x divide-white/15 text-center">
          <Metric value={route.total_orders} label={t('map.deliveryStops')} />
          <Metric value={route.total_orders - route.completed_orders} label={t('driver.remaining')} />
          <Metric value={route.depot?.name.replace('LogiRoute Depot ', '') ?? '—'} label={t('driver.startingPoint')} />
        </div>
      </div>
    </header>
  );
}

function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="px-2">
      <strong className="block text-lg">{value}</strong>
      <span className="mt-0.5 block text-[10px] font-medium text-teal-100">{label}</span>
    </div>
  );
}
