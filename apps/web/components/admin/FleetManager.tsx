'use client';

import { PlusIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import { useI18n } from '@/context/I18nContext';
import { useDepot } from '@/context/DepotContext';
import { withDepotQuery } from '@/components/depot-contracts';

import {
  isVehicleList,
  requestApi,
  type CreateVehicleInput,
  type Vehicle,
} from './api-contracts';
import { CreateVehicleDialog } from './CreateVehicleDialog';
import { FleetList } from './FleetList';
import { subscribeToDataInvalidated } from './orders-sync';

export function FleetManager() {
  const { locale, t } = useI18n();
  const { selectedDepot } = useDepot();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadVehicles() {
      try {
        const payload = await requestApi(withDepotQuery('/api/v1/vehicles', selectedDepot?.id ?? null));
        if (!isVehicleList(payload)) {
          throw new Error(t('fleet.invalidList'));
        }
        if (active) {
          setVehicles(payload);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : t('fleet.loadError'),
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadVehicles();
    const refreshInterval = window.setInterval(() => void loadVehicles(), 10000);
    const unsubscribe = subscribeToDataInvalidated(
      ['fleet'],
      () => void loadVehicles(),
    );
    return () => {
      active = false;
      window.clearInterval(refreshInterval);
      unsubscribe();
    };
  }, [selectedDepot?.id, t]);

  async function createVehicle(input: CreateVehicleInput) {
    const payload = await requestApi('/api/v1/vehicles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, depot_id: selectedDepot?.id ?? null }),
    });
    const createdVehicles = [payload];
    if (!isVehicleList(createdVehicles)) {
      throw new Error(t('fleet.invalidItem'));
    }

    setVehicles((current) => [createdVehicles[0], ...current]);
  }

  const availableCount = vehicles.filter((vehicle) => vehicle.status === 'IDLE').length;
  const totalCapacity = vehicles.reduce(
    (total, vehicle) => total + vehicle.capacity_kg,
    0,
  );
  const weightFormatter = new Intl.NumberFormat(
    locale === 'vi' ? 'vi-VN' : 'en-US',
    { maximumFractionDigits: 1 },
  );

  return (
    <section className="space-y-4" aria-labelledby="fleet-heading">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="fleet-heading" className="font-bold text-slate-950 dark:text-white text-base uppercase tracking-[0.14em]">{t('fleet.listTitle')}</h2>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {t('fleet.summary', {
              total: vehicles.length,
              available: availableCount,
              capacity: weightFormatter.format(totalCapacity),
            })}
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-sm bg-amber-700 dark:bg-amber-400 px-4 text-sm font-semibold text-white dark:text-slate-950 transition hover:bg-amber-800 dark:hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
          type="button"
          onClick={() => setIsCreateOpen(true)}
        >
          <PlusIcon aria-hidden="true" className="size-4" />
          {t('fleet.add')}
        </button>
      </header>

      {error && (
        <p className="rounded-sm border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300" role="alert">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-sm border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <FleetList vehicles={vehicles} isLoading={isLoading} />
      </div>

      {isCreateOpen && (
        <CreateVehicleDialog
          open
          onClose={() => setIsCreateOpen(false)}
          onCreate={createVehicle}
        />
      )}
    </section>
  );
}
