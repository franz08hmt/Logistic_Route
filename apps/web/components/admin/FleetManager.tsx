'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/context/I18nContext';

import {
  isVehicleList,
  requestApi,
  type CreateVehicleInput,
  type Vehicle,
} from './api-contracts';
import { CreateVehicleDialog } from './CreateVehicleDialog';
import { FleetList } from './FleetList';

export function FleetManager() {
  const { locale, t } = useI18n();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadVehicles() {
      try {
        const payload = await requestApi('/api/v1/vehicles');
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
    return () => {
      active = false;
    };
  }, [t]);

  async function createVehicle(input: CreateVehicleInput) {
    const payload = await requestApi('/api/v1/vehicles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
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
          <h2 id="fleet-heading" className="text-lg font-semibold text-slate-950 dark:text-white">{t('fleet.listTitle')}</h2>
          <p className="mt-2 text-xs text-slate-500">
            {t('fleet.summary', {
              total: vehicles.length,
              available: availableCount,
              capacity: weightFormatter.format(totalCapacity),
            })}
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
          type="button"
          onClick={() => setIsCreateOpen(true)}
        >
          <span className="text-lg leading-none" aria-hidden="true">＋</span>
          {t('fleet.add')}
        </button>
      </header>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300" role="alert">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
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
