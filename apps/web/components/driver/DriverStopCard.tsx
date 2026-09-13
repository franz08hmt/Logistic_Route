import type { DriverStop } from './driver-contracts';
import {
  CubeIcon,
  DevicePhoneMobileIcon,
  MapPinIcon,
  PhoneIcon,
  QrCodeIcon,
} from '@heroicons/react/24/outline';

import { formatVnd } from '@/components/cod/cod-format';
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
  onShowVietQr,
}: {
  stop: DriverStop;
  onUpdate: (stop: DriverStop) => void;
  onShowVietQr?: (stop: DriverStop) => void;
}) {
  const { t } = useI18n();
  const isTerminal = terminalDriverStatuses.has(stop.status);
  const translatedFailureReason = failureReasonTranslationKey(
    stop.failure_reason,
  );
  const showVietQrAction = Boolean(
    onShowVietQr
      && stop.cod_amount > 0
      && stop.payment_method !== 'PREPAID'
      && stop.cod_status === 'PENDING',
  );
  const footerColumns = 1
    + (stop.customer_phone ? 1 : 0)
    + (showVietQrAction ? 1 : 0)
    + 1;

  return (
    <li className="group relative grid grid-cols-[2.5rem_1fr] gap-3 pb-5 last:pb-0">
      <span className="absolute bottom-0 left-5 top-10 w-px bg-slate-200 group-last:hidden dark:bg-slate-800" aria-hidden="true" />
      <div className={`relative z-10 grid size-10 place-items-center rounded-full border-4 border-slate-50 text-sm font-bold dark:border-slate-950 ${
        stop.status === 'DELIVERED'
          ? 'bg-emerald-700 text-white dark:bg-emerald-400 dark:text-slate-950'
          : stop.status === 'FAILED'
            ? 'bg-red-700 text-white dark:bg-red-400 dark:text-slate-950'
            : 'bg-white text-amber-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-amber-300 dark:ring-slate-700'
      }`}>
        {stop.status === 'DELIVERED' ? '✓' : stop.status === 'FAILED' ? '!' : stop.stop_sequence}
      </div>

      <article className="min-w-0 rounded-sm border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <small className="font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              {t('driver.stopLabel', {
                sequence: String(stop.stop_sequence).padStart(2, '0'),
                code: stop.order_code,
              })}
            </small>
            <h3 className="mt-1 truncate text-base font-bold text-slate-950 dark:text-white">
              {stop.customer_name}
            </h3>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <CodBadge stop={stop} />
            <span className={driverStatusClass(stop.status)}>
              {t(driverStatusTranslationKeys[stop.status])}
            </span>
          </div>
        </header>

        <dl className="mt-4 grid gap-3 text-sm text-slate-600 dark:text-slate-300">
          <Detail icon={<MapPinIcon aria-hidden="true" className="size-4" />} label={t('driver.address')} value={stop.address} />
          <Detail
            icon={<PhoneIcon aria-hidden="true" className="size-4" />}
            label={t('driver.phone')}
            value={
              stop.customer_phone ? (
                <a className="font-semibold text-amber-700 underline-offset-4 hover:underline dark:text-amber-300" href={`tel:${stop.customer_phone}`}>
                  {stop.customer_phone}
                </a>
              ) : (
                t('driver.noPhone')
              )
            }
          />
          <Detail icon={<CubeIcon aria-hidden="true" className="size-4" />} label={t('driver.weight')} value={`${stop.weight_kg} kg`} />
        </dl>

        {(stop.delivery_note || stop.failure_reason) && (
          <div className={`mt-4 rounded-sm border p-3 text-xs leading-5 ${
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

        <footer className={`mt-4 grid grid-cols-1 gap-2 ${
          footerColumns >= 4
            ? 'sm:grid-cols-2 lg:grid-cols-4'
            : footerColumns === 3
              ? 'sm:grid-cols-3'
              : 'sm:grid-cols-2'
        }`}>
          {stop.customer_phone && (
            <a
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              href={`tel:${stop.customer_phone}`}
            >
              <PhoneIcon aria-hidden="true" className="size-4" /> {t('driver.callCustomer')}
            </a>
          )}
          {showVietQrAction && (
            <button
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm border border-amber-300 bg-amber-50 px-4 text-sm font-bold text-amber-800 transition hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-900"
              type="button"
              onClick={() => onShowVietQr?.(stop)}
            >
              <QrCodeIcon aria-hidden="true" className="size-4" /> {t('driver.cod.showVietQR')}
            </button>
          )}
          <a
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            href={mapNavigationUrl(stop)}
            target="_blank"
            rel="noreferrer"
          >
            ↗ {t('driver.openMaps')}
          </a>
          <button
            className="min-h-12 rounded-sm bg-amber-700 dark:bg-amber-400 px-4 text-sm font-bold text-white dark:text-slate-950 transition hover:bg-amber-800 dark:hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:bg-slate-200 disabled:text-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-300"
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

function CodBadge({ stop }: { stop: DriverStop }) {
  const { t, locale } = useI18n();

  if (stop.payment_method === 'PREPAID' || stop.cod_amount === 0) {
    return (
      <span className="rounded-sm bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        ✅ {t('driver.cod.prepaid')}
      </span>
    );
  }

  if (stop.cod_status === 'RECONCILED') {
    return (
      <span className="rounded-sm bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
        🏦 {t('driver.cod.reconciled')}
      </span>
    );
  }

  if (stop.cod_status === 'COLLECTED') {
    return (
      <span className="rounded-sm bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-900 dark:bg-orange-900/60 dark:text-orange-200">
        {stop.payment_method === 'VIETQR' ? '📱' : '💵'}{' '}
        {t('driver.cod.collected', {
          amount: formatVnd(stop.cod_amount, locale),
        })}
      </span>
    );
  }

  // Money still owed. High contrast so it reads in direct sunlight.
  return (
    <span className="rounded-sm bg-emerald-700 px-2.5 py-1 text-xs font-black text-white dark:bg-emerald-600">
      💵 {t('driver.cod.badge', { amount: formatVnd(stop.cod_amount, locale) })}
    </span>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1.25rem_5.25rem_1fr] gap-2">
      <span className="text-amber-700 dark:text-amber-400" aria-hidden="true">{icon}</span>
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="min-w-0 font-medium text-slate-800 dark:text-slate-200">{value}</dd>
    </div>
  );
}
