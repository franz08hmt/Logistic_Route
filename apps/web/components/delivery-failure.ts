import type { TranslationKey } from '@/lib/i18n/i18n';

const failureReasonTranslationKeys = {
  CUSTOMER_UNAVAILABLE: 'driver.failureCustomerUnavailable',
  WRONG_ADDRESS: 'driver.failureWrongAddress',
  RESCHEDULED: 'driver.failureRescheduled',
  REJECTED: 'driver.failureRejected',
} as const satisfies Record<string, TranslationKey>;

export function failureReasonTranslationKey(
  reason: string | null | undefined,
): TranslationKey | null {
  if (!reason || !(reason in failureReasonTranslationKeys)) {
    return null;
  }

  return failureReasonTranslationKeys[
    reason as keyof typeof failureReasonTranslationKeys
  ];
}
