'use client';

import {
  ListBulletIcon,
  TrophyIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
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
import { FilterBar, SearchField, SelectField } from '../ui/Controls';

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
      <FilterBar
        label={t('drivers.filterLabel')}
        resultCount={t('drivers.resultCount', { count: drivers.length })}
      >
        <SearchField
          hideLabel={false}
          label={t('drivers.searchLabel')}
          placeholder={t('drivers.searchPlaceholder')}
          value={search}
          onChange={setSearch}
        />
        <SelectField
          label={t('drivers.statusFilter')}
          value={statusFilter}
          onChange={(next) => setStatusFilter(next as DriverAccountStatus | '')}
        >
          <option value="">{t('drivers.allStatuses')}</option>
          {DRIVER_ACCOUNT_STATUSES.map((status) => (
            <option value={status} key={status}>
              {t(`drivers.accountStatus.${status}`)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('drivers.vehicleFilter')}
          value={vehicleFilter}
          onChange={(next) => setVehicleFilter(next as VehicleFilter)}
        >
          <option value="">{t('drivers.allVehicleStates')}</option>
          <option value="true">{t('drivers.withVehicle')}</option>
          <option value="false">{t('drivers.withoutVehicle')}</option>
        </SelectField>
      </FilterBar>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        {t('drivers.autoRefresh')}
      </p>

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
          <p className="grid min-h-72 place-items-center rounded-sm border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
            <span className="block">
              <span
                aria-hidden="true"
                className="mx-auto grid size-12 place-items-center rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
              >
                <UserPlusIcon className="size-6" strokeWidth={1.6} />
              </span>
              <strong className="mt-3 block text-base font-bold uppercase tracking-[0.14em] text-slate-950 dark:text-white">
                {t('drivers.emptyTitle')}
              </strong>
              <span className="mx-auto mt-1 block max-w-md text-sm text-slate-500 dark:text-slate-400">
                {t('drivers.emptyDescription')}
              </span>
            </span>
          </p>
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
