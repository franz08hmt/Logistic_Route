import { describe, expect, it } from 'vitest';

import { failureReasonTranslationKey } from './delivery-failure';

describe('failureReasonTranslationKey', () => {
  it('maps known backend reason codes to translation keys', () => {
    expect(failureReasonTranslationKey('CUSTOMER_UNAVAILABLE')).toBe(
      'driver.failureCustomerUnavailable',
    );
    expect(failureReasonTranslationKey('WRONG_ADDRESS')).toBe(
      'driver.failureWrongAddress',
    );
  });

  it('keeps free-text legacy reasons readable', () => {
    expect(failureReasonTranslationKey('Khách đổi lịch')).toBeNull();
    expect(failureReasonTranslationKey(null)).toBeNull();
  });
});
