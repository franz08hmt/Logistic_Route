'use client';

import { ListBulletIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useI18n } from '@/context/I18nContext';
import { useDepot } from '@/context/DepotContext';
import { requestApi } from './api-contracts';
import { DriverCard } from './DriverCard';
import { DriverLeaderboard } from './DriverLeaderboard';
import {
  DRIVER_ACCOUNT_STATUSES,
  isDriverDetailList,
  type DriverAccountStatus,
  type DriverDetail,
} from './driver-detail-contracts';
import { subscribeToDataInvalidated } from './orders-sync';

type VehicleFilter = '' | 'true' | 'false';

function DriverDirectory() {
  const { t } = useI18n();
  const { selectedDepot } = useDepot();
  const [drivers, setDrivers] = useState<DriverDetail[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DriverAccountStatus | ''>('');
  const [vehicleFilter, setVehicleFilter] = useState<VehicleFilter>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  const loadDrivers = useCallback(async () => {
    const requestId = ++requestSequence.current;
    const searchParams = new URLSearchParams();
    if (debouncedSearch) {
      searchParams.set('search', debouncedSearch);
    }
    if (statusFilter) {
      searchParams.set('status', statusFilter);
    }
    if (vehicleFilter) {
      searchParams.set('has_vehicle', vehicleFilter);
    }
    if (selectedDepot?.id) {
      searchParams.set('depot_id', selectedDepot.id);
    }

    try {
      const query = searchParams.toString();
      const payload = await requestApi(
        `/api/v1/admin/drivers${query ? `?${query}` : ''}`,
      );
      if (!isDriverDetailList(payload)) {
        throw new Error(t('drivers.invalidData'));
      }
      if (requestId !== requestSequence.current) {
        return;
      }
      setDrivers(payload);
      setError(null);
    } catch (requestError) {
      if (requestId !== requestSequence.current) {
        return;
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : t('drivers.loadError'),
      );
    } finally {
      if (requestId === requestSequence.current) {
        setIsLoading(false);
      }
    }
  }, [debouncedSearch, selectedDepot?.id, statusFilter, t, vehicleFilter]);

  useEffect(() => {
    setIsLoading(true);
    void loadDrivers();

    const intervalId = window.setInterval(() => {
      void loadDrivers();
    }, 15_000);
    const unsubscribe = subscribeToDataInvalidated(
      ['fleet', 'driver'],
      () => void loadDrivers(),
    );

    return () => {
      window.clearInterval(intervalId);
      unsubscribe();
    };
  }, [loadDrivers]);

  return (
    <section className="space-y-5" aria-labelledby="drivers-list-title">
      <div className="rounded-sm border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_13rem_13rem]">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t('drivers.searchLabel')}
            <span className="relative mt-2 block">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" />
              </svg>
              <input
                className="h-11 w-full rounded-sm border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 dark:border-slate-700 dark:bg-slate-950"
                type="search"
                value={search}
                placeholder={t('drivers.searchPlaceholder')}
                onChange={(event) => setSearch(event.target.value)}
              />
            </span>
          </label>

          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t('drivers.statusFilter')}
            <select
              className="mt-2 h-11 w-full rounded-sm border border-slate-300 bg-white px-3 text-sm outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 dark:border-slate-700 dark:bg-slate-950"
              value={statusFilter}
              onChange={(event) => setStatusFilter(
                event.target.value as DriverAccountStatus | '',
              )}
            >
              <option value="">{t('drivers.allStatuses')}</option>
              {DRIVER_ACCOUNT_STATUSES.map((status) => (
                <option value={status} key={status}>
                  {t(`drivers.accountStatus.${status}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t('drivers.vehicleFilter')}
            <select
              className="mt-2 h-11 w-full rounded-sm border border-slate-300 bg-white px-3 text-sm outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 dark:border-slate-700 dark:bg-slate-950"
              value={vehicleFilter}
              onChange={(event) => setVehicleFilter(event.target.value as VehicleFilter)}
            >
              <option value="">{t('drivers.allVehicleStates')}</option>
              <option value="true">{t('drivers.withVehicle')}</option>
              <option value="false">{t('drivers.withoutVehicle')}</option>
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t('drivers.autoRefresh')}</p>
      </div>

      {error && (
        <p className="rounded-sm border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300" role="alert">
          {error}
        </p>
      )}

      <div>
        <h2 className="sr-only" id="drivers-list-title">{t('drivers.listTitle')}</h2>
        {isLoading ? (
          <div className="grid gap-4 lg:grid-cols-2" aria-busy="true" aria-label={t('drivers.loading')}>
            {Array.from({ length: 4 }, (_, index) => (
              <div className="h-64 animate-pulse rounded-sm bg-slate-200/70 dark:bg-slate-800" key={index} />
            ))}
          </div>
        ) : drivers.length === 0 ? (
          <div className="grid min-h-72 place-items-center rounded-sm border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
            <div>
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                <svg className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="9" cy="7" r="4" />
                  <path d="M2 21v-2a7 7 0 0 1 14 0v2M17 8h5M19.5 5.5v5" />
                </svg>
              </span>
              <h3 className="mt-3 font-bold text-slate-950 dark:text-white text-base uppercase tracking-[0.14em]">{t('drivers.emptyTitle')}</h3>
              <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{t('drivers.emptyDescription')}</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {drivers.map((driver) => (
              <DriverCard driver={driver} key={driver.id} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function DriversManager() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'directory' | 'leaderboard'>('directory');

  return (
    <section className="space-y-5">
      <div className="inline-flex w-full rounded-sm border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900 sm:w-auto" role="tablist" aria-label={t('drivers.viewSelector')}>
        <button
          className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-sm px-4 text-sm font-semibold transition sm:flex-none ${
            activeTab === 'directory'
              ? 'bg-amber-700 dark:bg-amber-400 text-white dark:text-slate-950'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
          }`}
          id="drivers-directory-tab"
          aria-controls="drivers-directory-panel"
          aria-selected={activeTab === 'directory'}
          role="tab"
          type="button"
          onClick={() => setActiveTab('directory')}
        >
          <ListBulletIcon aria-hidden="true" className="size-4" />
          {t('drivers.tabDirectory')}
        </button>
        <button
          className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-sm px-4 text-sm font-semibold transition sm:flex-none ${
            activeTab === 'leaderboard'
              ? 'bg-amber-700 dark:bg-amber-400 text-white dark:text-slate-950'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
          }`}
          id="drivers-leaderboard-tab"
          aria-controls="drivers-leaderboard-panel"
          aria-selected={activeTab === 'leaderboard'}
          role="tab"
          type="button"
          onClick={() => setActiveTab('leaderboard')}
        >
          <TrophyIcon aria-hidden="true" className="size-4" />
          {t('drivers.tabLeaderboard')}
        </button>
      </div>

      <div
        id="drivers-directory-panel"
        aria-labelledby="drivers-directory-tab"
        hidden={activeTab !== 'directory'}
        role="tabpanel"
      >
        {activeTab === 'directory' && <DriverDirectory />}
      </div>
      <div
        id="drivers-leaderboard-panel"
        aria-labelledby="drivers-leaderboard-tab"
        hidden={activeTab !== 'leaderboard'}
        role="tabpanel"
      >
        {activeTab === 'leaderboard' && <DriverLeaderboard />}
      </div>
    </section>
  );
}
