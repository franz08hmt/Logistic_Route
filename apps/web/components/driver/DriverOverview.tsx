import { TruckIcon } from '@heroicons/react/24/outline';

import { useI18n } from '@/context/I18nContext';
import { HairlineCell, HairlineGrid, SectionHeading } from '../ui/Section';
import type { DriverRoute } from './driver-contracts';

/**
 * Shift summary for the signed-in driver.
 *
 * The page banner above already carries the eyebrow, title and description, so
 * this block no longer repeats them, and its greeting is an `h2`: the banner
 * owns the page's only `h1`. The saturated gradient slab it used to sit on was
 * the last surface still painted in the pre-redesign palette.
 */
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
    <section aria-labelledby="driver-shift-heading" className="space-y-5">
      <SectionHeading
        id="driver-shift-heading"
        title={t('driver.greeting', { name: driverName })}
        action={(
          <p className="inline-flex items-center gap-3 rounded-sm border border-slate-200 px-4 py-3 dark:border-cinema-line">
            <span
              className="grid size-10 shrink-0 place-items-center rounded-sm bg-cinema-accent/15 text-amber-700 dark:text-cinema-accent"
              aria-hidden="true"
            >
              <TruckIcon className="size-5" strokeWidth={1.5} />
            </span>
            <span>
              <small className="block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {t('driver.assignedVehicle')}
              </small>
              <strong className="mt-0.5 block text-lg font-extrabold tabular-nums text-slate-950 dark:text-white">
                {route.vehicle?.license_plate ?? t('driver.awaitingVehicle')}
              </strong>
            </span>
          </p>
        )}
      />

      <div className="rounded-sm border border-slate-200 p-5 dark:border-cinema-line">
        <p className="flex items-center justify-between gap-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            {t('driver.progress')}
          </span>
          <strong className="text-sm font-extrabold tabular-nums text-slate-950 dark:text-white">
            {t('driver.progressValue', {
              completed: route.completed_orders,
              total: route.total_orders,
              percent: progressPercent,
            })}
          </strong>
        </p>
        <span
          className="mt-3 block h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"
          role="progressbar"
          aria-label={t('driver.progressAria')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
        >
          <span
            className="block h-full rounded-full bg-amber-700 transition-all dark:bg-cinema-accent"
            style={{ width: `${progressPercent}%` }}
          />
        </span>
      </div>

      <HairlineGrid columns={3} as="div">
        <Metric value={route.total_orders} label={t('map.deliveryStops')} />
        <Metric
          value={route.total_orders - route.completed_orders}
          label={t('driver.remaining')}
        />
        <Metric
          value={route.depot?.name.replace('LogiRoute Depot ', '') ?? '—'}
          label={t('driver.startingPoint')}
        />
      </HairlineGrid>
    </section>
  );
}

function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <HairlineCell as="div">
      <p className="px-5 py-5">
        <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <strong className="mt-1.5 block text-2xl font-extrabold tabular-nums text-slate-950 dark:text-white">
          {value}
        </strong>
      </p>
    </HairlineCell>
  );
}
