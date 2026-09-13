'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useI18n } from '@/context/I18nContext';
import type { TranslationKey, TranslationValues } from '@/lib/i18n/i18n';
import { requestApi } from './api-contracts';
import {
  DIAGNOSTIC_TEST_KEYS,
  isSystemDiagnosticsResponse,
  isSystemHealthResponse,
  type DiagnosticTestKey,
  type ServiceHealthItem,
  type SystemDiagnosticsResponse,
  type SystemHealthResponse,
  type SystemHealthStatus,
  type SystemServiceKey,
} from './system-contracts';
import { downloadSystemAuditReport } from './system-report-export';

type Translator = (key: TranslationKey, values?: TranslationValues) => string;

const SERVICE_META: Record<SystemServiceKey, {
  icon: string;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
}> = {
  database: {
    icon: '🗄️',
    titleKey: 'system.services.database',
    descriptionKey: 'system.services.databaseDescription',
  },
  core_engine: {
    icon: '⚡',
    titleKey: 'system.services.coreEngine',
    descriptionKey: 'system.services.coreEngineDescription',
  },
  osrm_routing: {
    icon: '🗺️',
    titleKey: 'system.services.osrm',
    descriptionKey: 'system.services.osrmDescription',
  },
  telemetry: {
    icon: '📡',
    titleKey: 'system.services.telemetry',
    descriptionKey: 'system.services.telemetryDescription',
  },
  notifications: {
    icon: '💬',
    titleKey: 'system.services.notifications',
    descriptionKey: 'system.services.notificationsDescription',
  },
  storage: {
    icon: '📁',
    titleKey: 'system.services.storage',
    descriptionKey: 'system.services.storageDescription',
  },
};

const DIAGNOSTIC_LABELS: Record<DiagnosticTestKey, TranslationKey> = {
  database_spatial: 'system.diagnostics.tests.database',
  core_engine_solve: 'system.diagnostics.tests.coreEngine',
  routing_polyline: 'system.diagnostics.tests.routing',
  tracking_token: 'system.diagnostics.tests.security',
  storage_permissions: 'system.diagnostics.tests.storage',
};

const STATUS_STYLES: Record<SystemHealthStatus, string> = {
  HEALTHY: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
  DEGRADED: 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950/50 dark:text-orange-200',
  DOWN: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200',
};

function detailNumber(service: ServiceHealthItem, key: string): number | null {
  const value = service.details[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function detailString(service: ServiceHealthItem, key: string): string | null {
  const value = service.details[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function detailBoolean(service: ServiceHealthItem, key: string): boolean | null {
  const value = service.details[key];
  return typeof value === 'boolean' ? value : null;
}

function uptimeLabel(seconds: number, locale: 'vi' | 'en'): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return locale === 'vi' ? `${days} ngày ${hours} giờ` : `${days}d ${hours}h`;
  if (hours > 0) return locale === 'vi' ? `${hours} giờ ${minutes} phút` : `${hours}h ${minutes}m`;
  return locale === 'vi' ? `${minutes} phút` : `${minutes}m`;
}

function serviceDetails(
  service: ServiceHealthItem,
  t: Translator,
  numberFormat: Intl.NumberFormat,
): Array<{ label: string; value: string }> {
  const yesNo = (value: boolean | null) => (
    value === null
      ? t('system.value.unavailable')
      : t(value ? 'system.value.yes' : 'system.value.no')
  );
  const number = (key: string, suffix = '') => {
    const value = detailNumber(service, key);
    return value === null ? t('system.value.unavailable') : `${numberFormat.format(value)}${suffix}`;
  };
  const text = (key: string) => detailString(service, key) ?? t('system.value.unavailable');

  switch (service.service_key) {
    case 'database':
      return [
        { label: t('system.details.tables'), value: number('table_count') },
        { label: t('system.details.records'), value: number('record_count') },
        { label: t('system.details.postgis'), value: text('postgis_version') },
      ];
    case 'core_engine':
      return [
        { label: t('system.details.readiness'), value: text('readiness') },
        { label: t('system.details.version'), value: text('solver_version') },
        { label: t('system.details.algorithm'), value: text('algorithm') },
      ];
    case 'osrm_routing':
      return [
        { label: t('system.details.routingGraph'), value: text('routing_graph') },
        { label: t('system.details.fallback'), value: text('fallback') },
        { label: t('system.details.cached'), value: yesNo(detailBoolean(service, 'cached')) },
      ];
    case 'telemetry':
      return [
        { label: t('system.details.activeVehicles'), value: number('active_vehicles_last_hour') },
        { label: t('system.details.offRouteWarnings'), value: number('off_route_warnings') },
        { label: t('system.details.deviationFilter'), value: text('deviation_filter') },
      ];
    case 'notifications':
      return [
        { label: t('system.details.messagesSent'), value: number('sent_count') },
        { label: t('system.details.successRate'), value: number('success_rate_percent', '%') },
        { label: t('system.details.queueDepth'), value: number('queue_depth') },
      ];
    case 'storage':
      return [
        { label: t('system.details.writable'), value: yesNo(detailBoolean(service, 'writable')) },
        { label: t('system.details.files'), value: number('file_count') },
        { label: t('system.details.availableDisk'), value: number('available_gb', ' GB') },
      ];
  }
}

function ServiceCard({
  service,
  t,
  numberFormat,
  dateTimeFormat,
}: {
  service: ServiceHealthItem;
  t: Translator;
  numberFormat: Intl.NumberFormat;
  dateTimeFormat: Intl.DateTimeFormat;
}) {
  const meta = SERVICE_META[service.service_key];
  const details = serviceDetails(service, t, numberFormat);
  return (
    <article className="rounded-sm border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-slate-100 text-lg dark:bg-slate-800" aria-hidden="true">
          {meta.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-slate-950 dark:text-white text-base uppercase tracking-[0.14em]">{t(meta.titleKey)}</h2>
            <span className={`rounded-full border px-2 py-1 text-[10px] font-bold tracking-wide ${STATUS_STYLES[service.status]}`}>
              {t(`system.status.${service.status}` as TranslationKey)}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{t(meta.descriptionKey)}</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 divide-x divide-slate-200 border-y border-slate-200 py-3 dark:divide-slate-800 dark:border-slate-800">
        {details.map((detail) => (
          <div className="min-w-0 px-3 first:pl-0 last:pr-0" key={detail.label}>
            <dt className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{detail.label}</dt>
            <dd className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100" title={detail.value}>{detail.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span>{t('system.details.latency')}</span>
        <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
          {service.latency_ms === null ? '—' : `${numberFormat.format(service.latency_ms)} ms`}
        </span>
      </div>
      <p className="mt-1 text-right text-[10px] text-slate-400">
        {t('system.lastChecked', { time: dateTimeFormat.format(new Date(service.last_checked_at)) })}
      </p>
    </article>
  );
}

export function SystemHealthDashboard() {
  const { locale, t } = useI18n();
  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [diagnostics, setDiagnostics] = useState<SystemDiagnosticsResponse | null>(null);
  const [isHealthLoading, setIsHealthLoading] = useState(true);
  const [isDiagnosticsRunning, setIsDiagnosticsRunning] = useState(false);
  const [activeDiagnosticStep, setActiveDiagnosticStep] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const numberLocale = locale === 'vi' ? 'vi-VN' : 'en-US';
  const numberFormat = useMemo(
    () => new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 2 }),
    [numberLocale],
  );
  const dateTimeFormat = useMemo(
    () => new Intl.DateTimeFormat(numberLocale, { dateStyle: 'short', timeStyle: 'medium' }),
    [numberLocale],
  );

  const loadHealth = useCallback(async (signal?: AbortSignal) => {
    setIsHealthLoading(true);
    try {
      const payload = await requestApi('/api/v1/system/health', { signal });
      if (!isSystemHealthResponse(payload)) throw new Error(t('system.invalidData'));
      setHealth(payload);
      setError(null);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
      setError(requestError instanceof Error ? requestError.message : t('system.loadError'));
    } finally {
      if (!signal?.aborted) setIsHealthLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const controller = new AbortController();
    void loadHealth(controller.signal);
    return () => controller.abort();
  }, [loadHealth]);

  const runDiagnostics = async () => {
    if (isDiagnosticsRunning) return;
    setIsDiagnosticsRunning(true);
    setDiagnostics(null);
    setActiveDiagnosticStep(0);
    const intervalId = window.setInterval(() => {
      setActiveDiagnosticStep((current) => Math.min((current ?? 0) + 1, DIAGNOSTIC_TEST_KEYS.length - 1));
    }, 450);
    try {
      const payload = await requestApi('/api/v1/system/diagnostics', { method: 'POST' });
      if (!isSystemDiagnosticsResponse(payload)) throw new Error(t('system.invalidData'));
      setDiagnostics(payload);
      setError(null);
      await loadHealth();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('system.diagnostics.runError'));
    } finally {
      window.clearInterval(intervalId);
      setActiveDiagnosticStep(null);
      setIsDiagnosticsRunning(false);
    }
  };

  const status = health?.overall_status ?? 'DEGRADED';
  const heroTitleKey = `system.hero.${status.toLowerCase()}` as TranslationKey;
  const heroDescriptionKey = `system.hero.${status.toLowerCase()}Description` as TranslationKey;

  return (
    <div className="space-y-6">
      <section className={`rounded-sm border p-5 sm:p-6 ${STATUS_STYLES[status]}`} aria-live="polite">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className={`size-3 rounded-full ${status === 'HEALTHY' ? 'animate-pulse bg-emerald-500' : status === 'DEGRADED' ? 'bg-orange-500' : 'bg-rose-500'}`} aria-hidden="true" />
              <h2 className="font-bold tracking-tight sm: text-base uppercase tracking-[0.14em]">
                {isHealthLoading && !health ? t('system.loading') : t(heroTitleKey)}
              </h2>
            </div>
            <p className="mt-2 max-w-2xl text-sm opacity-80">
              {isHealthLoading && !health ? t('system.loadingDescription') : t(heroDescriptionKey)}
            </p>
          </div>
          <button
            className="inline-flex min-h-10 items-center justify-center rounded-sm border border-current/20 bg-white/70 px-4 text-sm font-semibold transition hover:bg-white disabled:cursor-wait disabled:opacity-60 dark:bg-slate-950/30 dark:hover:bg-slate-950/60"
            disabled={isHealthLoading}
            type="button"
            onClick={() => void loadHealth()}
          >
            {isHealthLoading ? t('system.refreshing') : t('system.refresh')}
          </button>
        </div>
        {health && (
          <dl className="mt-5 grid gap-3 border-t border-current/15 pt-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide opacity-70">{t('system.serverTime')}</dt>
              <dd className="mt-1 font-medium">{dateTimeFormat.format(new Date(health.server_time))}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide opacity-70">{t('system.uptime')}</dt>
              <dd className="mt-1 font-medium">{uptimeLabel(health.uptime_seconds, locale)}</dd>
            </div>
          </dl>
        )}
      </section>

      {error && (
        <div className="flex flex-col gap-3 rounded-sm border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <span>{error}</span>
          <button className="font-semibold underline underline-offset-4" type="button" onClick={() => void loadHealth()}>
            {t('system.retry')}
          </button>
        </div>
      )}

      {!health && isHealthLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label={t('system.loading')}>
          {Array.from({ length: 6 }, (_, index) => (
            <div className="h-60 animate-pulse rounded-sm bg-slate-200/70 dark:bg-slate-800" key={index} />
          ))}
        </div>
      ) : health ? (
        <section aria-label={t('system.servicesTitle')}>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">{t('system.servicesEyebrow')}</p>
              <h2 className="mt-1 font-bold text-slate-950 dark:text-white text-base uppercase tracking-[0.14em]">{t('system.servicesTitle')}</h2>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">6 / 6</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {health.services.map((service) => (
              <ServiceCard
                dateTimeFormat={dateTimeFormat}
                key={service.service_key}
                numberFormat={numberFormat}
                service={service}
                t={t}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-sm border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">{t('system.diagnostics.eyebrow')}</p>
            <h2 className="mt-1 font-bold text-slate-950 dark:text-white text-base uppercase tracking-[0.14em]">{t('system.diagnostics.title')}</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{t('system.diagnostics.description')}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-sm bg-amber-700 dark:bg-amber-400 px-4 text-sm font-semibold text-white dark:text-slate-950 transition hover:bg-amber-800 dark:hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
              disabled={isDiagnosticsRunning}
              type="button"
              onClick={() => void runDiagnostics()}
            >
              {isDiagnosticsRunning ? t('system.diagnostics.running') : t('system.diagnostics.run')}
            </button>
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-sm border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:border-amber-500 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
              disabled={!health || !diagnostics}
              type="button"
              onClick={() => {
                if (health && diagnostics) downloadSystemAuditReport(health, diagnostics);
              }}
            >
              {t('system.export')}
            </button>
          </div>
        </div>

        <div className="bg-slate-950 p-4 text-slate-200 sm:p-5" aria-live="polite" aria-busy={isDiagnosticsRunning}>
          <div className="mb-4 flex items-center gap-2 border-b border-slate-800 pb-3 font-mono text-xs text-slate-400">
            <span className="size-2 rounded-full bg-rose-400" aria-hidden="true" />
            <span className="size-2 rounded-full bg-orange-400" aria-hidden="true" />
            <span className="size-2 rounded-full bg-emerald-400" aria-hidden="true" />
            <span className="ml-2">{t('system.diagnostics.consoleLabel')}</span>
          </div>
          <ol className="space-y-3 font-mono text-xs sm:text-sm">
            {DIAGNOSTIC_TEST_KEYS.map((testKey, index) => {
              const result = diagnostics?.tests.find((test) => test.test_key === testKey);
              const isActive = isDiagnosticsRunning && activeDiagnosticStep === index;
              const isQueued = isDiagnosticsRunning && (activeDiagnosticStep ?? 0) < index;
              const marker = result
                ? result.status === 'PASS' ? '[✓ PASS]' : '[✕ FAIL]'
                : isActive ? '[… RUN ]' : isQueued ? '[  WAIT]' : '[  --  ]';
              const markerClass = result
                ? result.status === 'PASS' ? 'text-emerald-400' : 'text-rose-400'
                : isActive ? 'animate-pulse text-orange-300' : 'text-slate-400';
              return (
                <li className="grid gap-1 sm:grid-cols-[5rem_1fr_auto] sm:items-start" key={testKey}>
                  <span className={`font-bold ${markerClass}`}>{marker}</span>
                  <span>
                    <span className="text-slate-100">{t(DIAGNOSTIC_LABELS[testKey])}</span>
                    {result && <span className="mt-1 block text-xs leading-5 text-slate-400">{result.detail}</span>}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">{result ? `${numberFormat.format(result.duration_ms)} ms` : ''}</span>
                </li>
              );
            })}
          </ol>
          {diagnostics && (
            <div className={`mt-5 rounded-sm border px-4 py-3 text-sm ${diagnostics.overall_status === 'PASS' ? 'border-emerald-900 bg-emerald-950/40 text-emerald-300' : 'border-rose-900 bg-rose-950/40 text-rose-300'}`} role="status">
              <strong>{diagnostics.overall_status === 'PASS' ? t('system.diagnostics.summaryPass') : t('system.diagnostics.summaryFail')}</strong>
              <span className="mt-1 block text-xs opacity-80">
                {t('system.diagnostics.summaryCounts', { passed: diagnostics.passed_count, failed: diagnostics.failed_count, duration: numberFormat.format(diagnostics.total_duration_ms) })}
              </span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
