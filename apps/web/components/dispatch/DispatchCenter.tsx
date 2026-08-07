'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  isOrderList,
  isVehicleList,
  requestApi,
  type Order,
  type Vehicle,
} from '@/components/admin/api-contracts';
import {
  publishDataInvalidated,
  publishOrdersUpdated,
  subscribeToDataInvalidated,
} from '@/components/admin/orders-sync';
import { useI18n } from '@/context/I18nContext';
import { downloadManifestCsv } from '@/components/route-optimization/manifest-export';
import {
  buildRouteReorderPayload,
  hasRoutePlanChanged,
  moveRouteStop,
} from '@/components/route-optimization/manual-route-editor';
import { RouteCostSummary } from '@/components/route-optimization/RouteCostSummary';
import { RouteListPanel } from '@/components/route-optimization/RouteListPanel';
import type { OptimizationResult } from '@/components/route-optimization/types';
import {
  requestFleetOptimization,
  requestRouteReorder,
  toOptimizationResult,
  type MultiStopDispatchResult,
} from './dispatch-contracts';
import { DispatchWorkspace } from './DispatchWorkspace';
import {
  requestVehicleTelemetry,
  summarizeTelemetry,
  type VehicleTelemetryItem,
} from './telemetry-contracts';

const RouteMap = dynamic(
  () => import('@/components/route-optimization/RouteMap').then(
    (module) => module.RouteMap,
  ),
  { ssr: false },
);

export function DispatchCenter() {
  const { t } = useI18n();
  const mapSectionRef = useRef<HTMLElement>(null);
  const [routeResult, setRouteResult] = useState<OptimizationResult | null>(null);
  const [persistedRouteResult, setPersistedRouteResult] = useState<OptimizationResult | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isOptimizingFleet, setIsOptimizingFleet] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTelemetryEnabled, setIsTelemetryEnabled] = useState(true);
  const [telemetry, setTelemetry] = useState<VehicleTelemetryItem[]>([]);
  const [hasTelemetryError, setHasTelemetryError] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'success'; message: string } | null>(null);

  const orderWeights = useMemo(
    () => new Map(orders.map((order) => [order.id, order.weight_kg])),
    [orders],
  );
  const vehicleCapacities = useMemo(
    () => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.capacity_kg])),
    [vehicles],
  );
  const hasChanges = hasRoutePlanChanged(persistedRouteResult, routeResult);
  const telemetrySummary = useMemo(
    () => summarizeTelemetry(telemetry),
    [telemetry],
  );

  async function refreshOperationalData() {
    const [ordersPayload, vehiclesPayload] = await Promise.all([
      requestApi('/api/v1/orders'),
      requestApi('/api/v1/vehicles'),
    ]);
    if (!isOrderList(ordersPayload) || !isVehicleList(vehiclesPayload)) {
      throw new Error(t('routeEditor.invalidOperationalData'));
    }
    setOrders(ordersPayload);
    setVehicles(vehiclesPayload);
    return ordersPayload;
  }

  useEffect(() => {
    void refreshOperationalData().catch(() => {
      // The workspace still supports planning; server validation protects saves.
    });
    return subscribeToDataInvalidated(
      ['orders', 'fleet'],
      () => void refreshOperationalData().catch(() => undefined),
    );
    // Translation changes do not need to refetch operational data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const timeoutId = window.setTimeout(() => setFeedback(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  useEffect(() => {
    if (!isTelemetryEnabled) {
      setHasTelemetryError(false);
      return undefined;
    }

    let disposed = false;
    let activeController: AbortController | null = null;
    async function refreshTelemetry() {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      try {
        const response = await requestVehicleTelemetry(controller.signal);
        if (!disposed) {
          setTelemetry(response.vehicles);
          setHasTelemetryError(false);
        }
      } catch (error) {
        if (!disposed && !(error instanceof DOMException && error.name === 'AbortError')) {
          setHasTelemetryError(true);
        }
      }
    }

    void refreshTelemetry();
    const intervalId = window.setInterval(() => void refreshTelemetry(), 5_000);
    return () => {
      disposed = true;
      activeController?.abort();
      window.clearInterval(intervalId);
    };
  }, [isTelemetryEnabled]);

  function commitResult(result: OptimizationResult) {
    setRouteResult(result);
    setPersistedRouteResult(result);
  }

  function scrollToMapOnNarrowScreens() {
    if (window.matchMedia('(max-width: 1279px)').matches) {
      window.setTimeout(() => {
        mapSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 0);
    }
  }

  function handleRoutePlanned(
    result: MultiStopDispatchResult,
    refreshedOrders: Order[],
  ) {
    commitResult(toOptimizationResult(result));
    setOrders(refreshedOrders);
    scrollToMapOnNarrowScreens();
  }

  async function optimizeFleet() {
    setIsOptimizingFleet(true);
    setFeedback(null);
    try {
      const result = await requestFleetOptimization();
      commitResult(result);
      const refreshedOrders = await refreshOperationalData();
      publishOrdersUpdated(refreshedOrders);
      publishDataInvalidated(['orders', 'fleet', 'driver', 'overview', 'analytics']);
      setFeedback({ tone: 'success', message: t('routeEditor.fleetOptimized') });
      scrollToMapOnNarrowScreens();
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : t('routeEditor.optimizeFleetError'),
      });
    } finally {
      setIsOptimizingFleet(false);
    }
  }

  function handleMoveStop(
    sourceVehicleId: string,
    sourceIndex: number,
    destinationVehicleId: string,
    destinationIndex: number,
  ) {
    if (!routeResult) return;
    const moved = moveRouteStop({
      result: routeResult,
      sourceVehicleId,
      sourceIndex,
      destinationVehicleId,
      destinationIndex,
      orderWeights,
      vehicleCapacities,
    });
    if (!moved.ok) {
      if (moved.reason === 'CAPACITY_EXCEEDED') {
        const vehicle = vehicles.find((item) => item.id === moved.vehicleId);
        setFeedback({
          tone: 'error',
          message: t('routeEditor.capacityExceeded', {
            vehicle: vehicle?.license_plate ?? moved.vehicleId,
            weight: moved.attemptedWeightKg,
            capacity: moved.capacityKg,
          }),
        });
      }
      return;
    }
    setFeedback(null);
    setRouteResult(moved.result);
  }

  async function saveRoutePlan() {
    if (!routeResult || !hasChanges) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      const saved = await requestRouteReorder(buildRouteReorderPayload(routeResult));
      commitResult(saved);
      const refreshedOrders = await refreshOperationalData();
      publishOrdersUpdated(refreshedOrders);
      publishDataInvalidated(['orders', 'fleet', 'driver', 'overview', 'analytics']);
      setFeedback({ tone: 'success', message: t('routeEditor.saved') });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : t('routeEditor.saveError'),
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-950 dark:text-white">
            {t('routeEditor.title')}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {t('routeEditor.description')}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={() => void optimizeFleet()}
            disabled={isOptimizingFleet || isSaving}
          >
            {isOptimizingFleet ? t('routeEditor.optimizingFleet') : t('routeEditor.optimizeFleet')}
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-teal-200 bg-teal-50 px-4 text-sm font-semibold text-teal-800 shadow-sm xl:hidden dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300"
            type="button"
            onClick={() => mapSectionRef.current?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            })}
          >
            {t('dispatch.viewMap')}
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            feedback.tone === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
          }`}
          role={feedback.tone === 'error' ? 'alert' : 'status'}
        >
          {feedback.message}
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(30rem,1.05fr)]">
        <DispatchWorkspace onRoutePlanned={handleRoutePlanned} />

        <section
          className="scroll-mt-20 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
          ref={mapSectionRef}
          aria-labelledby="dispatch-map-title"
        >
          <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-400">
                {t('dispatch.mapEyebrow')}
              </p>
              <h2
                className="mt-1 text-sm font-semibold text-slate-950 dark:text-white"
                id="dispatch-map-title"
              >
                {t('dispatch.mapTitle')}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2" aria-live="polite">
              {isTelemetryEnabled && (
                <>
                  <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-800 dark:bg-teal-950/50 dark:text-teal-300">
                    {t('telemetry.activeCount', { count: telemetrySummary.activeVehicles })}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    telemetrySummary.offRouteVehicles > 0
                      ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}>
                    {t('telemetry.offRouteCount', { count: telemetrySummary.offRouteVehicles })}
                  </span>
                </>
              )}
              <button
                type="button"
                role="switch"
                aria-checked={isTelemetryEnabled}
                onClick={() => setIsTelemetryEnabled((enabled) => !enabled)}
                className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ${
                  isTelemetryEnabled
                    ? 'border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-950/50 dark:text-teal-300'
                    : 'border-slate-300 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                }`}
              >
                <span
                  className={`size-2.5 rounded-full ${
                    isTelemetryEnabled ? 'animate-pulse bg-emerald-500' : 'bg-slate-400'
                  }`}
                  aria-hidden="true"
                />
                {isTelemetryEnabled ? t('telemetry.liveOn') : t('telemetry.liveOff')}
              </button>
            </div>
          </header>
          {hasTelemetryError && isTelemetryEnabled && (
            <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300" role="status">
              {t('telemetry.refreshError')}
            </p>
          )}
          <div className="relative h-[28rem] min-h-[22rem] sm:h-[34rem]">
            <RouteMap
              result={routeResult}
              orders={orders}
              telemetry={isTelemetryEnabled ? telemetry : []}
            />
          </div>
          <RouteListPanel
            result={routeResult}
            vehicleCapacities={vehicleCapacities}
            onMoveStop={handleMoveStop}
          />

          {hasChanges && (
            <div className="sticky bottom-0 z-[500] flex flex-col gap-3 border-t border-amber-200 bg-amber-50/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur sm:flex-row sm:items-center sm:justify-between dark:border-amber-900 dark:bg-amber-950/90">
              <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
                {t('routeEditor.unsavedChanges')}
              </p>
              <div className="flex gap-2">
                <button
                  className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  type="button"
                  onClick={() => setRouteResult(persistedRouteResult)}
                  disabled={isSaving}
                >
                  {t('routeEditor.cancel')}
                </button>
                <button
                  className="min-h-10 rounded-lg bg-teal-600 px-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  onClick={() => void saveRoutePlan()}
                  disabled={isSaving || !routeResult?.route_batch_id}
                >
                  {isSaving ? t('routeEditor.saving') : t('routeEditor.save')}
                </button>
              </div>
            </div>
          )}

          <RouteCostSummary
            result={routeResult}
            onExport={() => {
              if (routeResult) {
                downloadManifestCsv(routeResult, orders);
              }
            }}
          />
        </section>
      </div>
    </div>
  );
}
