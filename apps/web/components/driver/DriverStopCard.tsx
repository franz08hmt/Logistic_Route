import type { DriverStop } from './driver-contracts';
import { useI18n } from '@/context/I18nContext';
import {
  driverStatusClass,
  driverStatusTranslationKeys,
  mapNavigationUrl,
  terminalDriverStatuses,
} from './driver-ui';
import { failureReasonTranslationKey } from '../delivery-failure';

export function DriverStopCard({
  stop,
  onUpdate,
}: {
  stop: DriverStop;
  onUpdate: (stop: DriverStop) => void;
}) {
  const { t } = useI18n();
  const isTerminal = terminalDriverStatuses.has(stop.status);
  const translatedFailureReason = failureReasonTranslationKey(
    stop.failure_reason,
  );

  return (
    <li className="group relative grid grid-cols-[2.5rem_1fr] gap-3 pb-5 last:pb-0">
      <span className="absolute bottom-0 left-5 top-10 w-px bg-slate-200 group-last:hidden dark:bg-slate-800" aria-hidden="true" />
      <div className={`relative z-10 grid size-10 place-items-center rounded-full border-4 border-slate-50 text-sm font-bold dark:border-slate-950 ${
        stop.status === 'DELIVERED'
          ? 'bg-emerald-600 text-white'
          : stop.status === 'FAILED'
            ? 'bg-red-600 text-white'
            : 'bg-white text-teal-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-teal-300 dark:ring-slate-700'
      }`}>
        {stop.status === 'DELIVERED' ? '✓' : stop.status === 'FAILED' ? '!' : stop.stop_sequence}
      </div>

      <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <small className="font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t('driver.stopLabel', {
                sequence: String(stop.stop_sequence).padStart(2, '0'),
                code: stop.order_code,
              })}
            </small>
            <h3 className="mt-1 truncate text-base font-bold text-slate-950 dark:text-white">
              {stop.customer_name}
            </h3>
          </div>
          <span className={driverStatusClass(stop.status)}>
            {t(driverStatusTranslationKeys[stop.status])}
          </span>
        </header>

        <dl className="mt-4 grid gap-3 text-sm text-slate-600 dark:text-slate-300">
          <Detail icon="⌖" label={t('driver.address')} value={stop.address} />
          <Detail
            icon="☎"
            label={t('driver.phone')}
            value={
              stop.customer_phone ? (
                <a className="font-semibold text-teal-700 underline-offset-4 hover:underline dark:text-teal-300" href={`tel:${stop.customer_phone}`}>
                  {stop.customer_phone}
                </a>
              ) : (
                t('driver.noPhone')
              )
            }
          />
          <Detail icon="◆" label={t('driver.weight')} value={`${stop.weight_kg} kg`} />
        </dl>

        {(stop.delivery_note || stop.failure_reason) && (
          <div className={`mt-4 rounded-xl border p-3 text-xs leading-5 ${
            stop.failure_reason
              ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
              : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300'
          }`}>
            {stop.failure_reason && (
              <p>
                <strong>{t('driver.failureReason')}</strong>{' '}
                {translatedFailureReason
                  ? t(translatedFailureReason)
                  : stop.failure_reason}
              </p>
            )}
            {stop.delivery_note && <p><strong>{t('driver.note')}</strong> {stop.delivery_note}</p>}
          </div>
        )}

        <footer className={`mt-4 grid grid-cols-1 gap-2 ${stop.customer_phone ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          {stop.customer_phone && (
            <a
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              href={`tel:${stop.customer_phone}`}
            >
              ☎ {t('driver.callCustomer')}
            </a>
          )}
          <a
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            href={mapNavigationUrl(stop)}
            target="_blank"
            rel="noreferrer"
          >
            ↗ {t('driver.openMaps')}
          </a>
          <button
            className="min-h-12 rounded-xl bg-teal-600 px-4 text-sm font-bold text-white transition hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-slate-800"
            type="button"
            onClick={() => onUpdate(stop)}
            disabled={isTerminal}
          >
            {isTerminal ? t('driver.processed') : t('driver.updateStatus')}
          </button>
        </footer>
      </article>
    </li>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1.25rem_5.25rem_1fr] gap-2">
      <span className="text-teal-700 dark:text-teal-400" aria-hidden="true">{icon}</span>
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 font-medium text-slate-800 dark:text-slate-200">{value}</dd>
    </div>
  );
}
