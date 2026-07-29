import type { DriverOrderStatus, DriverStop } from './driver-contracts';
import type { TranslationKey } from '@/lib/i18n/i18n';

export const driverStatusTranslationKeys: Record<
  DriverOrderStatus,
  TranslationKey
> = {
  ASSIGNED: 'status.ASSIGNED',
  DELIVERING: 'status.DELIVERING',
  DELIVERED: 'status.DELIVERED',
  FAILED: 'status.FAILED',
};

export const terminalDriverStatuses = new Set<DriverOrderStatus>([
  'DELIVERED',
  'FAILED',
]);

export const updateDriverStatuses: DriverOrderStatus[] = [
  'DELIVERED',
  'FAILED',
];

export function driverStatusClass(status: DriverOrderStatus): string {
  const base =
    'inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide';
  const variants: Record<DriverOrderStatus, string> = {
    ASSIGNED:
      'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
    DELIVERING:
      'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
    DELIVERED:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
    FAILED: 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300',
  };
  return `${base} ${variants[status]}`;
}

export function mapNavigationUrl(stop: DriverStop): string {
  const destination = encodeURIComponent(`${stop.latitude},${stop.longitude}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}
