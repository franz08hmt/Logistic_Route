'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { ModalDialog } from '@/components/admin/ModalDialog';
import {
  isAvailableDriverList,
  isOrderList,
  requestApi,
  type AvailableDriver,
  type Order,
} from '@/components/admin/api-contracts';
import {
  publishDataInvalidated,
  publishOrdersUpdated,
  subscribeToDataInvalidated,
} from '@/components/admin/orders-sync';
import { useI18n } from '@/context/I18nContext';
import { useDepot } from '@/context/DepotContext';
import { withDepotQuery } from '@/components/depot-contracts';
import {
  DispatchApiError,
  requestMultiStopDispatch,
  type MultiStopDispatchResult,
} from './dispatch-contracts';

export function DispatchWorkspace({
  onRoutePlanned,
}: {
  onRoutePlanned?: (
    result: MultiStopDispatchResult,
    orders: Order[],
  ) => void;
}) {
  const { locale, t } = useI18n();
  const { selectedDepot } = useDepot();
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<AvailableDriver[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [driverId, setDriverId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MultiStopDispatchResult | null>(null);
  const [regionMismatch, setRegionMismatch] = useState<DispatchApiError | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [ordersPayload, driversPayload] = await Promise.all([
        requestApi(withDepotQuery('/api/v1/orders', selectedDepot?.id ?? null)),
        requestApi(withDepotQuery('/api/v1/admin/drivers/available', selectedDepot?.id ?? null)),
      ]);
      if (!isOrderList(ordersPayload) || !isAvailableDriverList(driversPayload)) {
        throw new Error(t('dispatch.invalidData'));
      }
      const pendingOrders = ordersPayload.filter((order) => order.status === 'PENDING');
      setOrders(pendingOrders);
      setDrivers(driversPayload);
      setSelectedOrderIds((current) => new Set(
        [...current].filter((orderId) => pendingOrders.some((order) => order.id === orderId)),
      ));
      setDriverId((current) => (
        driversPayload.some((driver) => driver.driver_id === current)
          ? current
          : driversPayload[0]?.driver_id ?? ''
      ));
      setError(null);
      return ordersPayload;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('dispatch.loadError'));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [selectedDepot?.id, t]);

  useEffect(() => {
    void loadData();
    return subscribeToDataInvalidated(['orders', 'fleet'], () => void loadData());
  }, [loadData]);

  const selectedOrders = useMemo(
    () => orders.filter((order) => selectedOrderIds.has(order.id)),
    [orders, selectedOrderIds],
  );
  const selectedDriver = drivers.find((driver) => driver.driver_id === driverId) ?? null;
  const totalWeight = selectedOrders.reduce((sum, order) => sum + order.weight_kg, 0);
  const isOverCapacity = selectedDriver !== null && totalWeight > selectedDriver.capacity_kg;
  const numberFormatter = new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    maximumFractionDigits: 1,
  });

  function toggleOrder(orderId: string) {
    setSelectedOrderIds((current) => {
      const next = new Set(current);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  }

  async function executeDispatch(forceRegionMismatch = false) {
    if (selectedOrders.length < 2 || !driverId || isOverCapacity) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const dispatchResult = await requestMultiStopDispatch({
        order_ids: selectedOrders.map((order) => order.id),
        driver_id: driverId,
        force_region_mismatch: forceRegionMismatch,
      });
      setResult(dispatchResult);
      setSelectedOrderIds(new Set());
      setRegionMismatch(null);
      const refreshedOrders = await loadData();
      if (refreshedOrders) {
        publishOrdersUpdated(refreshedOrders);
      }
      onRoutePlanned?.(dispatchResult, refreshedOrders ?? orders);
      publishDataInvalidated(['orders', 'fleet', 'driver', 'overview', 'analytics']);
    } catch (requestError) {
      if (
        requestError instanceof DispatchApiError
        && requestError.detail?.code === 'REGION_MISMATCH'
        && !forceRegionMismatch
      ) {
        setRegionMismatch(requestError);
      } else {
        setError(requestError instanceof Error ? requestError.message : t('dispatch.submitError'));
        if (requestError instanceof DispatchApiError && requestError.status === 409) {
          void loadData();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const allSelected = orders.length > 0 && selectedOrderIds.size === orders.length;

  return (
    <section className="space-y-5">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <header className="flex flex-col gap-3 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-950 dark:text-white">{t('dispatch.pendingOrders')}</h2>
            <p className="mt-1 text-sm text-slate-500">{t('dispatch.pendingHint')}</p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <input
              className="size-4 rounded border-slate-300 accent-teal-600"
              type="checkbox"
              checked={allSelected}
              disabled={orders.length === 0}
              onChange={(event) => setSelectedOrderIds(
                event.target.checked ? new Set(orders.map((order) => order.id)) : new Set(),
              )}
            />
            {t('dispatch.selectAll')}
          </label>
        </header>

        {error && (
          <p className="m-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300" role="alert">
            {error}
          </p>
        )}

        {isLoading ? (
          <div className="space-y-3 p-5" aria-busy="true">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" key={index} />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="grid min-h-64 place-items-center p-8 text-center">
            <div>
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">✓</span>
              <h3 className="mt-3 font-semibold text-slate-950 dark:text-white">{t('dispatch.emptyTitle')}</h3>
              <p className="mt-1 text-sm text-slate-500">{t('dispatch.emptyDescription')}</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {orders.map((order) => (
              <label
                className={`flex cursor-pointer gap-4 p-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/50 sm:p-5 ${
                  selectedOrderIds.has(order.id) ? 'bg-teal-50/60 dark:bg-teal-950/20' : ''
                }`}
                key={order.id}
              >
                <input
                  className="mt-1 size-4 shrink-0 rounded border-slate-300 accent-teal-600"
                  type="checkbox"
                  checked={selectedOrderIds.has(order.id)}
                  onChange={() => toggleOrder(order.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm text-slate-950 dark:text-white">{order.order_code}</strong>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {numberFormatter.format(order.weight_kg)} kg
                    </span>
                  </span>
                  <span className="mt-1 block text-sm text-slate-700 dark:text-slate-300">{order.customer_name}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{order.address}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <aside className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-teal-700 dark:text-teal-400">{t('dispatch.planEyebrow')}</span>
          <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{t('dispatch.planTitle')}</h2>

          <label className="mt-5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            {t('dispatch.driver')}
            <select
              className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-slate-700 dark:bg-slate-950"
              value={driverId}
              onChange={(event) => setDriverId(event.target.value)}
            >
              <option value="">{t('dispatch.selectDriver')}</option>
              {drivers.map((driver) => (
                <option value={driver.driver_id} key={driver.driver_id}>
                  {driver.full_name} · {driver.license_plate} · {numberFormatter.format(driver.capacity_kg)} kg
                </option>
              ))}
            </select>
          </label>

          <dl className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60">
              <dt className="text-xs text-slate-500">{t('dispatch.selectedStops')}</dt>
              <dd className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{selectedOrders.length}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60">
              <dt className="text-xs text-slate-500">{t('dispatch.totalWeight')}</dt>
              <dd className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{numberFormatter.format(totalWeight)} kg</dd>
            </div>
          </dl>

          {isOverCapacity && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" role="alert">
              {t('dispatch.capacityExceeded', { capacity: numberFormatter.format(selectedDriver.capacity_kg) })}
            </p>
          )}
          {selectedOrders.length === 1 && (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">{t('dispatch.minimumStops')}</p>
          )}

          <button
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={isSubmitting || selectedOrders.length < 2 || !driverId || isOverCapacity}
            onClick={() => void executeDispatch()}
          >
            {isSubmitting ? t('dispatch.optimizing') : t('dispatch.optimizeAndAssign')}
          </button>
        </div>

        {result && (
          <div className="rounded-xl border border-teal-200 bg-teal-50 p-5 dark:border-teal-900 dark:bg-teal-950/30" role="status">
            <span className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">{t('dispatch.success')}</span>
            <h3 className="mt-1 font-semibold text-slate-950 dark:text-white">{result.driver_name} · {result.license_plate}</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {t('dispatch.resultSummary', {
                stops: result.stops.length,
                distance: numberFormatter.format(result.total_distance_km),
                minutes: numberFormatter.format(result.total_duration_mins),
              })}
            </p>
            <ol className="mt-4 space-y-2">
              {[...result.stops].sort((a, b) => a.stop_sequence - b.stop_sequence).map((stop) => (
                <li className="flex gap-3 text-sm" key={stop.order_id}>
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-teal-600 text-xs font-bold text-white">{stop.stop_sequence}</span>
                  <span><strong className="block text-slate-900 dark:text-white">{stop.order_code}</strong><small className="text-slate-500">{stop.address}</small></span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </aside>

      <ModalDialog
        open={regionMismatch !== null}
        eyebrow={t('dispatch.regionWarningEyebrow')}
        title={t('dispatch.regionWarningTitle')}
        description={regionMismatch?.message ?? t('dispatch.regionWarningDescription')}
        onClose={() => setRegionMismatch(null)}
      >
        <div className="space-y-4 p-5 sm:p-6">
          <p className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {t('dispatch.regionWarningDetail', {
              driver: regionMismatch?.detail?.driver_name ?? '—',
              driverRegion: regionMismatch?.detail?.driver_region ?? '—',
              deliveryRegions: regionMismatch?.detail?.delivery_regions?.join(', ') ?? '—',
            })}
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-semibold dark:border-slate-700" type="button" onClick={() => setRegionMismatch(null)}>
              {t('dispatch.chooseAgain')}
            </button>
            <button className="h-10 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700" type="button" onClick={() => void executeDispatch(true)}>
              {t('dispatch.confirmMismatch')}
            </button>
          </div>
        </div>
      </ModalDialog>
    </section>
  );
}
