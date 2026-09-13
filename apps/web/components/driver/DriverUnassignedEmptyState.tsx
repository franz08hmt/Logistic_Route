'use client';

import { useI18n } from '@/context/I18nContext';

export function DriverUnassignedEmptyState({
  isRefreshing,
  onRefresh,
}: {
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  const { t } = useI18n();

  return (
    <section
      className="overflow-hidden rounded-sm border border-amber-100 bg-white dark:border-amber-950 dark:bg-slate-900"
      aria-labelledby="driver-onboarding-title"
    >
      <div className="border-b border-slate-100 bg-gradient-to-br from-amber-50 via-white to-slate-50 px-5 py-8 text-center dark:border-slate-800 dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-950 sm:px-10 sm:py-10">
        <div className="mx-auto grid size-16 place-items-center rounded-sm bg-amber-100 text-amber-700 ring-8 ring-amber-50 dark:bg-amber-900/70 dark:text-amber-300 dark:ring-amber-950/50" aria-hidden="true">
          <svg className="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5h11v9H3zM14 11h4l3 3v2.5h-7z" />
            <circle cx="7" cy="18" r="1.8" />
            <circle cx="17" cy="18" r="1.8" />
            <path strokeLinecap="round" d="M6 7.5V5a2 2 0 0 1 2-2h5" />
          </svg>
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-400">{t('driver.onboardingEyebrow')}</p>
        <h1 id="driver-onboarding-title" className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">{t('driver.onboardingTitle')}</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">{t('driver.onboardingDescription')}</p>
      </div>

      <div className="px-5 py-7 sm:px-10 sm:py-8">
        <ol className="grid gap-5 md:grid-cols-3 md:gap-0" aria-label={t('driver.onboardingStepsLabel')}>
          <Step number="1" title={t('driver.stepActivation')} state="complete" />
          <Step number="2" title={t('driver.stepVehicle')} state="current" />
          <Step number="3" title={t('driver.stepTrip')} state="locked" />
        </ol>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-amber-700 dark:bg-amber-400 px-5 text-sm font-semibold text-white dark:text-slate-950 transition hover:bg-amber-800 dark:hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-wait disabled:opacity-70"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-busy={isRefreshing}
          >
            {isRefreshing && <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />}
            {isRefreshing ? t('driver.checkingAssignment') : t('driver.checkAssignment')}
          </button>
          <a
            className="inline-flex h-11 items-center justify-center gap-2 rounded-sm border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-amber-300 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-amber-800 dark:hover:bg-amber-950/30"
            href="tel:+842812345678"
          >
            <span aria-hidden="true">☎</span>
            {t('driver.contactDispatcher')}
          </a>
        </div>
      </div>
    </section>
  );
}

function Step({
  number,
  title,
  state,
}: {
  number: string;
  title: string;
  state: 'complete' | 'current' | 'locked';
}) {
  const styles = {
    complete: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
    current: 'border-amber-300 bg-amber-50 text-amber-800 ring-2 ring-amber-600/10 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
    locked: 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-500',
  } as const;
  const icon = state === 'complete' ? '✓' : number;

  return (
    <li className="relative flex items-center gap-3 md:flex-col md:items-center md:text-center">
      <span className={`grid size-10 shrink-0 place-items-center rounded-full border text-sm font-bold ${styles[state]}`} aria-hidden="true">{icon}</span>
      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</span>
      {state === 'complete' && <span className="text-xs text-emerald-700 dark:text-emerald-400">✓</span>}
      {state === 'current' && <span className="text-xs text-amber-700 dark:text-amber-400">…</span>}
    </li>
  );
}
