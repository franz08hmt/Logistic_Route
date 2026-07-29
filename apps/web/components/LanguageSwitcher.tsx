'use client';

import { useI18n } from '@/context/I18nContext';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/i18n/i18n';

const shortLabels: Record<Locale, string> = {
  vi: 'VI',
  en: 'EN',
};

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      role="group"
      aria-label={t('language.label')}
    >
      <span className="px-1.5 text-slate-400" aria-hidden="true">◎</span>
      {SUPPORTED_LOCALES.map((supportedLocale) => (
        <button
          key={supportedLocale}
          type="button"
          className={`min-w-8 rounded-md px-1.5 py-1 text-[10px] font-bold transition focus-visible:outline-2 focus-visible:outline-teal-600 ${
            locale === supportedLocale
              ? 'bg-teal-600 text-white'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
          onClick={() => setLocale(supportedLocale)}
          aria-pressed={locale === supportedLocale}
          title={t(`language.${supportedLocale}`)}
        >
          {shortLabels[supportedLocale]}
        </button>
      ))}
    </div>
  );
}
