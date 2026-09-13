import type { OrderStatus, VehicleStatus } from './api-contracts';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/i18n';

const labelKeys: Record<OrderStatus | VehicleStatus, TranslationKey> = {
  PENDING: 'status.PENDING',
  ASSIGNED: 'status.ASSIGNED',
  DELIVERING: 'status.DELIVERING',
  DELIVERED: 'status.DELIVERED',
  FAILED: 'status.FAILED',
  IDLE: 'status.IDLE',
  ON_ROUTE: 'status.ON_ROUTE',
};

const styles: Record<OrderStatus | VehicleStatus, string> = {
  PENDING: 'bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-950/50 dark:text-orange-300',
  ASSIGNED: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-950/50 dark:text-sky-300',
  DELIVERING: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-950/50 dark:text-indigo-300',
  DELIVERED: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300',
  FAILED: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-950/50 dark:text-rose-300',
  IDLE: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300',
  ON_ROUTE: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-950/50 dark:text-sky-300',
};

export function StatusBadge({ status }: { status: OrderStatus | VehicleStatus }) {
  const { t } = useI18n();

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles[status]}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {t(labelKeys[status])}
    </span>
  );
}
