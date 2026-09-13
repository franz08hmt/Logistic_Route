'use client';

import Link from 'next/link';

import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/i18n';
import type { DriverDetail } from './driver-detail-contracts';

type DriverPresentationStatus = {
  labelKey: TranslationKey;
  className: string;
  dotClassName: string;
};

function getPresentationStatus(driver: DriverDetail): DriverPresentationStatus {
  if (driver.status === 'SUSPENDED') {
    return {
      labelKey: 'drivers.statusSuspended',
      className: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
      dotClassName: 'bg-rose-500',
    };
  }
  if (driver.status === 'PENDING_APPROVAL') {
    return {
      labelKey: 'drivers.statusPending',
      className: 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
      dotClassName: 'bg-orange-500',
    };
  }
  if (!driver.vehicle_id) {
    return {
      labelKey: 'drivers.statusUnassigned',
      className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      dotClassName: 'bg-slate-400',
    };
  }
  if (driver.vehicle_status === 'ON_ROUTE') {
    return {
      labelKey: 'drivers.statusOnRoute',
      className: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
      dotClassName: 'bg-sky-500',
    };
  }
  return {
    labelKey: 'drivers.statusReady',
    className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    dotClassName: 'bg-emerald-500',
  };
}

export function DriverCard({ driver }: { driver: DriverDetail }) {
  const { locale, t } = useI18n();
  const status = getPresentationStatus(driver);
  const numberFormatter = new Intl.NumberFormat(
    locale === 'vi' ? 'vi-VN' : 'en-US',
    { maximumFractionDigits: 0 },
  );

  return (
    <article className="rounded-sm border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover: dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-amber-50 text-sm font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            {driver.full_name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-slate-950 dark:text-white">
              {driver.full_name}
            </h2>
            <p className="mt-1 break-all text-sm text-slate-500 dark:text-slate-400">
              {driver.email}
              <span aria-hidden="true"> · </span>
              {driver.phone_number ?? t('drivers.noPhone')}
            </p>
          </div>
        </div>
        <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>
          <span className={`size-2 rounded-full ${status.dotClassName}`} aria-hidden="true" />
          {t(status.labelKey)}
        </span>
      </div>

      <div className="mt-5 rounded-sm border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
        {driver.vehicle_id ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">
                {driver.license_plate}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {driver.vehicle_type}
                <span aria-hidden="true"> · </span>
                {numberFormatter.format(driver.capacity_kg ?? 0)} kg
              </p>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              <span className="font-medium">{t('drivers.serviceArea')}:</span>{' '}
              {driver.service_area ?? t('drivers.noServiceArea')}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('drivers.noVehicle')}</p>
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-sm bg-amber-700 dark:bg-amber-400 px-4 text-sm font-semibold text-white dark:text-slate-950 hover:bg-amber-800 dark:hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
              href="/fleet"
            >
              {t('drivers.assignVehicle')}
            </Link>
          </div>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-3 divide-x divide-slate-200 rounded-sm border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        <div className="p-3 text-center">
          <dt className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">{t('drivers.deliveredToday')}</dt>
          <dd className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {driver.delivered_today_count}
          </dd>
        </div>
        <div className="p-3 text-center">
          <dt className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">{t('drivers.activeOrders')}</dt>
          <dd className="mt-1 text-lg font-bold text-sky-600 dark:text-sky-400">
            {driver.active_orders_count}
          </dd>
        </div>
        <div className="p-3 text-center">
          <dt className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">{t('drivers.failedToday')}</dt>
          <dd className="mt-1 text-lg font-bold text-rose-600 dark:text-rose-400">
            {driver.failed_today_count}
          </dd>
        </div>
      </dl>
    </article>
  );
}
