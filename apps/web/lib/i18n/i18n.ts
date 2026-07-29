import enMessages from '../../messages/en.json';
import viMessages from '../../messages/vi.json';

export const SUPPORTED_LOCALES = ['vi', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type TranslationKey = keyof typeof viMessages;
export type TranslationValues = Record<string, string | number>;

export const DEFAULT_LOCALE: Locale = 'vi';
export const LOCALE_STORAGE_KEY = 'logiroute.locale';
export const LOCALE_COOKIE_NAME = 'logiroute_locale';

const dictionaries: Record<Locale, Record<TranslationKey, string>> = {
  vi: viMessages,
  en: enMessages,
};

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === 'string' &&
    SUPPORTED_LOCALES.includes(value as Locale)
  );
}

export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function translate(
  locale: Locale,
  key: TranslationKey,
  values: TranslationValues = {},
): string {
  const message = dictionaries[locale][key] ?? dictionaries[DEFAULT_LOCALE][key];
  return Object.entries(values).reduce(
    (translated, [name, value]) =>
      translated.replaceAll(`{${name}}`, String(value)),
    message,
  );
}

export function getDictionaryIssues(): string[] {
  const viKeys = Object.keys(viMessages);
  const enKeys = new Set(Object.keys(enMessages));
  const issues = viKeys
    .filter((key) => !enKeys.has(key))
    .map((key) => `Missing English key: ${key}`);

  for (const key of enKeys) {
    if (!(key in viMessages)) {
      issues.push(`Missing Vietnamese key: ${key}`);
    }
  }
  return issues;
}
