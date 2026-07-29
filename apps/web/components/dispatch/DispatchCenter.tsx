'use client';

import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';

import type { Order } from '@/components/admin/api-contracts';
import { useI18n } from '@/context/I18nContext';
import { downloadManifestCsv } from '@/components/route-optimization/manifest-export';
import { RouteCostSummary } from '@/components/route-optimization/RouteCostSummary';
import type { OptimizationResult } from '@/components/route-optimization/types';
import {
  toOptimizationResult,
  type MultiStopDispatchResult,
} from './dispatch-contracts';
import { DispatchWorkspace } from './DispatchWorkspace';

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
  const [orders, setOrders] = useState<Order[]>([]);

  function handleRoutePlanned(
    result: MultiStopDispatchResult,
    refreshedOrders: Order[],
  ) {
    setRouteResult(toOptimizationResult(result));
    setOrders(refreshedOrders);
    if (window.matchMedia('(max-width: 1279px)').matches) {
      window.setTimeout(() => {
        mapSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 0);
    }
  }

  return (
    <div className="space-y-4">
      <button
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-teal-200 bg-teal-50 px-4 text-sm font-semibold text-teal-800 shadow-sm dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300 xl:hidden"
        type="button"
        onClick={() => mapSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })}
      >
        {t('dispatch.viewMap')}
      </button>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(30rem,1.05fr)]">
        <DispatchWorkspace onRoutePlanned={handleRoutePlanned} />

        <section
          className="scroll-mt-20 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:sticky xl:top-20"
          ref={mapSectionRef}
          aria-labelledby="dispatch-map-title"
        >
          <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-400">
              {t('dispatch.mapEyebrow')}
            </p>
            <h2
              className="mt-1 text-sm font-semibold text-slate-950 dark:text-white"
              id="dispatch-map-title"
            >
              {t('dispatch.mapTitle')}
            </h2>
          </header>
          <div className="relative h-[28rem] min-h-[22rem] sm:h-[34rem]">
            <RouteMap result={routeResult} orders={orders} />
          </div>
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
