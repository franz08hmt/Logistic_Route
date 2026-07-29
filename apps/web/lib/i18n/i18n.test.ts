import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LOCALE,
  getDictionaryIssues,
  resolveLocale,
  translate,
} from './i18n';

describe('i18n locale resolution', () => {
  it('uses Vietnamese as the default locale', () => {
    expect(DEFAULT_LOCALE).toBe('vi');
    expect(resolveLocale(null)).toBe('vi');
    expect(resolveLocale('fr')).toBe('vi');
  });

  it('accepts each supported locale', () => {
    expect(resolveLocale('vi')).toBe('vi');
    expect(resolveLocale('en')).toBe('en');
  });
});

describe('i18n translations', () => {
  it('returns the requested Vietnamese and English messages', () => {
    expect(translate('vi', 'navigation.dashboard')).toBe('Tổng quan');
    expect(translate('en', 'navigation.dashboard')).toBe('Overview');
  });

  it('interpolates named values without changing the dictionary', () => {
    expect(
      translate('en', 'orders.summary.total', { count: 12 }),
    ).toBe('12 total orders');
  });

  it('keeps the Vietnamese and English dictionaries in sync', () => {
    expect(getDictionaryIssues()).toEqual([]);
  });
});
