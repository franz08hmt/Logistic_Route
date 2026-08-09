'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { isOrderList, requestApi } from '@/components/admin/api-contracts';
import {
  publishDataInvalidated,
  publishOrdersUpdated,
} from '@/components/admin/orders-sync';
import { ModalDialog } from '@/components/admin/ModalDialog';
import { useAuth } from '@/context/AuthContext';
import { useDepot } from '@/context/DepotContext';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/i18n';
import {
  loadDemoScenario,
  type ScenarioLoadResponse,
} from './demo-contracts';

type DemoTourModalProps = {
  open: boolean;
  onClose: () => void;
};

type TourStep = {
  icon: string;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  actionKey: TranslationKey;
  href: string;
  driverOnly?: boolean;
};

const TOUR_STEPS: TourStep[] = [
  {
    icon: '📌',
    titleKey: 'demo.steps.optimization.title',
    descriptionKey: 'demo.steps.optimization.description',
    actionKey: 'demo.steps.optimization.action',
    href: '/dispatch',
  },
  {
    icon: '🚚',
    titleKey: 'demo.steps.telemetry.title',
    descriptionKey: 'demo.steps.telemetry.description',
    actionKey: 'demo.steps.telemetry.action',
    href: '/dispatch',
  },
  {
    icon: '📱',
    titleKey: 'demo.steps.driver.title',
    descriptionKey: 'demo.steps.driver.description',
    actionKey: 'demo.steps.driver.action',
    href: '/driver',
    driverOnly: true,
  },
  {
    icon: '🔍',
    titleKey: 'demo.steps.tracking.title',
    descriptionKey: 'demo.steps.tracking.description',
    actionKey: 'demo.steps.tracking.action',
    href: '/orders',
  },
  {
    icon: '📊',
    titleKey: 'demo.steps.insights.title',
    descriptionKey: 'demo.steps.insights.description',
    actionKey: 'demo.steps.insights.action',
    href: '/analytics',
  },
];

const STACK_ITEMS = [
  ['⚡', 'demo.architecture.core.title', 'demo.architecture.core.description'],
  ['🧩', 'demo.architecture.api.title', 'demo.architecture.api.description'],
  ['🖥️', 'demo.architecture.frontend.title', 'demo.architecture.frontend.description'],
] as const satisfies ReadonlyArray<readonly [string, TranslationKey, TranslationKey]>;

export function DemoTourModal({ open, onClose }: DemoTourModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { refreshDepots } = useDepot();
  const { t } = useI18n();
  const [tab, setTab] = useState<'tour' | 'architecture'>('tour');
  const [activeStep, setActiveStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ScenarioLoadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = user?.role === 'ADMIN';
  const step = TOUR_STEPS[activeStep];

  const progressLabel = useMemo(
    () => t('demo.stepProgress', { current: activeStep + 1, total: TOUR_STEPS.length }),
    [activeStep, t],
  );

  const handleLoadScenario = async () => {
    if (!isAdmin || isLoading) {
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const loaded = await loadDemoScenario('HCMC_PEAK_DAY');
      await refreshDepots('HUB-SGN');
      publishDataInvalidated([
        'orders',
        'fleet',
        'driver',
        'overview',
        'analytics',
      ]);
      const ordersPayload = await requestApi('/api/v1/orders').catch(() => null);
      if (isOrderList(ordersPayload)) {
        publishOrdersUpdated(ordersPayload);
      }
      setResult(loaded);
    } catch (loadError) {
      let message = t('demo.loadError');
      if (loadError instanceof Error) {
        message = loadError.message === 'INVALID_SCENARIO_RESPONSE'
          ? t('demo.invalidResponse')
          : loadError.message;
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToStep = () => {
    if (step.driverOnly && user?.role !== 'DRIVER') {
      return;
    }
    onClose();
    router.push(step.href);
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      eyebrow={t('demo.eyebrow')}
      title={t('demo.title')}
      description={t('demo.description')}
    >
      <div className="max-h-[min(68vh,46rem)] overflow-y-auto px-5 py-5 sm:px-6">
        <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'tour'}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === 'tour' ? 'bg-white text-teal-700 shadow-sm dark:bg-slate-950 dark:text-teal-300' : 'text-slate-500'}`}
            onClick={() => setTab('tour')}
          >
            {t('demo.tabs.tour')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'architecture'}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === 'architecture' ? 'bg-white text-teal-700 shadow-sm dark:bg-slate-950 dark:text-teal-300' : 'text-slate-500'}`}
            onClick={() => setTab('architecture')}
          >
            {t('demo.tabs.architecture')}
          </button>
        </div>

        {tab === 'tour' ? (
          <div className="mt-5 space-y-5">
            <section className="overflow-hidden rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-emerald-50 p-5 dark:border-teal-900 dark:from-teal-950/60 dark:to-emerald-950/30">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">{t('demo.scenario.eyebrow')}</span>
                  <h3 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">{t('demo.scenario.title')}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{t('demo.scenario.description')}</p>
                </div>
                <button
                  type="button"
                  disabled={!isAdmin || isLoading}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
                  onClick={() => void handleLoadScenario()}
                >
                  {isLoading && <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
                  {isLoading ? t('demo.scenario.loading') : t('demo.scenario.action')}
                </button>
              </div>
              {!isAdmin && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-200" role="note">
                  {t('demo.scenario.adminOnly')}
                </p>
              )}
              {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-200" role="alert">{error}</p>}
              {result && (
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" role="status">
                  {[
                    [result.orders_loaded, t('demo.scenario.orders')],
                    [result.vehicles_loaded, t('demo.scenario.vehicles')],
                    [result.delivered_orders, t('demo.scenario.delivered')],
                    [result.active_telemetry_vehicles, t('demo.scenario.liveVehicles')],
                  ].map(([value, label]) => (
                    <div key={String(label)} className="rounded-xl border border-white/70 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-900/70">
                      <strong className="block text-xl text-teal-700 dark:text-teal-300">{value}</strong>
                      <span className="text-xs text-slate-500">{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section aria-labelledby="demo-workflow-heading">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">{t('demo.workflow.eyebrow')}</span>
                  <h3 id="demo-workflow-heading" className="mt-1 text-lg font-bold">{t('demo.workflow.title')}</h3>
                </div>
                <span className="text-xs font-semibold text-slate-500">{progressLabel}</span>
              </div>

              <div className="mt-4 flex gap-2" aria-label={progressLabel}>
                {TOUR_STEPS.map((item, index) => (
                  <button
                    key={item.titleKey}
                    type="button"
                    aria-label={t(item.titleKey)}
                    aria-current={index === activeStep ? 'step' : undefined}
                    className={`h-2 flex-1 rounded-full transition ${index === activeStep ? 'bg-teal-600' : index < activeStep ? 'bg-teal-300 dark:bg-teal-800' : 'bg-slate-200 dark:bg-slate-700'}`}
                    onClick={() => setActiveStep(index)}
                  />
                ))}
              </div>

              <article className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-start gap-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-teal-50 text-2xl dark:bg-teal-950" aria-hidden="true">{step.icon}</span>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{progressLabel}</span>
                    <h4 className="mt-1 text-lg font-bold">{t(step.titleKey)}</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{t(step.descriptionKey)}</p>
                  </div>
                </div>
                {step.driverOnly && user?.role !== 'DRIVER' && (
                  <p className="mt-4 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">{t('demo.driverAccountRequired')}</p>
                )}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-2">
                    <button type="button" disabled={activeStep === 0} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-40 dark:border-slate-700" onClick={() => setActiveStep((value) => Math.max(0, value - 1))}>{t('demo.previous')}</button>
                    <button type="button" disabled={activeStep === TOUR_STEPS.length - 1} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-40 dark:border-slate-700" onClick={() => setActiveStep((value) => Math.min(TOUR_STEPS.length - 1, value + 1))}>{t('demo.next')}</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeStep === 4 && isAdmin && (
                      <button type="button" className="rounded-lg border border-teal-200 px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50 dark:border-teal-800 dark:text-teal-300 dark:hover:bg-teal-950" onClick={() => { onClose(); router.push('/admin/system'); }}>{t('demo.steps.insights.systemAction')}</button>
                    )}
                    <button
                      type="button"
                      disabled={Boolean(step.driverOnly && user?.role !== 'DRIVER')}
                      className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-teal-600 dark:hover:bg-teal-500 dark:disabled:bg-slate-700"
                      onClick={navigateToStep}
                    >
                      {t(step.actionKey)}
                    </button>
                  </div>
                </div>
              </article>
            </section>
          </div>
        ) : (
          <section className="mt-5" aria-labelledby="demo-architecture-heading">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">{t('demo.architecture.eyebrow')}</span>
            <h3 id="demo-architecture-heading" className="mt-1 text-lg font-bold">{t('demo.architecture.title')}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{t('demo.architecture.description')}</p>
            <div className="mt-5 grid gap-3">
              {STACK_ITEMS.map(([icon, titleKey, descriptionKey], index) => (
                <div key={titleKey} className="relative flex gap-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal-50 text-xl dark:bg-teal-950" aria-hidden="true">{icon}</span>
                  <div>
                    <h4 className="font-bold">{t(titleKey)}</h4>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{t(descriptionKey)}</p>
                  </div>
                  {index < STACK_ITEMS.length - 1 && <span className="absolute -bottom-3 left-[2.15rem] z-10 text-teal-500" aria-hidden="true">↓</span>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </ModalDialog>
  );
}
