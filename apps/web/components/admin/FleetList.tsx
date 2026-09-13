'use client';

import { TruckIcon } from '@heroicons/react/24/outline';
import { useI18n } from '@/context/I18nContext';
import type { Vehicle } from './api-contracts';
import { StatusBadge } from './StatusBadge';

export function FleetList({
  vehicles,
  isLoading,
}: {
  vehicles: Vehicle[];
  isLoading: boolean;
}) {
  const { locale, t } = useI18n();
  const weightFormatter = new Intl.NumberFormat(
    locale === 'vi' ? 'vi-VN' : 'en-US',
    { maximumFractionDigits: 1 },
  );

  if (isLoading) {
    return (
      <div className="space-y-3 p-4" aria-label={t('fleet.loading')} aria-busy="true">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-sm bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
    );
  }

  if (vehicles.length === 0) {
    return (
      <div className="grid min-h-64 place-items-center px-4 py-12 text-center" role="status">
        <div>
          <span className="mx-auto grid size-11 place-items-center rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" aria-hidden="true"><TruckIcon className="size-5" /></span>
          <h3 className="mt-3 font-bold text-slate-950 dark:text-white text-base uppercase tracking-[0.14em]">{t('fleet.emptyTitle')}</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('fleet.emptyDescription')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 p-4 sm:grid-cols-2 md:hidden">
        {vehicles.map((vehicle) => (
          <article key={vehicle.id} className="rounded-sm border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-start justify-between gap-3">
              <strong className="text-base text-slate-950 dark:text-white">{vehicle.license_plate}</strong>
              <StatusBadge status={vehicle.status} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">{t('fleet.capacity')}</dt>
                <dd className="mt-1 font-medium text-slate-800 dark:text-slate-200">{weightFormatter.format(vehicle.capacity_kg)} kg</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">{t('fleet.driver')}</dt>
                <dd className="mt-1 truncate font-medium text-slate-800 dark:text-slate-200">{vehicle.driver_name || t('fleet.unassigned')}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{t('fleet.tableCaption')}</caption>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/50">
              {[t('fleet.licensePlate'), t('fleet.maxCapacity'), t('fleet.assignedDriver'), t('common.status')].map((heading) => (
                <th key={heading} scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {vehicles.map((vehicle) => (
              <tr key={vehicle.id} className="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                <td className="px-5 py-4 font-semibold text-slate-950 dark:text-white">{vehicle.license_plate}</td>
                <td className="px-5 py-4 text-sm text-slate-700 dark:text-slate-300">{weightFormatter.format(vehicle.capacity_kg)} kg</td>
                <td className="px-5 py-4">
                  {vehicle.driver_name ? (
                    <span className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <span className="grid size-8 place-items-center rounded-full bg-slate-100 text-xs font-bold dark:bg-slate-800">
                        {vehicle.driver_name.charAt(0).toUpperCase()}
                      </span>
                      {vehicle.driver_name}
                    </span>
                  ) : <span className="text-sm text-slate-500 dark:text-slate-400">{t('fleet.unassigned')}</span>}
                </td>
                <td className="px-5 py-4"><StatusBadge status={vehicle.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
