'use client';

import { useI18n } from '@/context/I18nContext';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/i18n/i18n';
import type { ControlTone } from './ThemeToggle';

const shortLabels: Record<Locale, string> = {
  vi: 'VI',
  en: 'EN',
};

export function LanguageSwitcher({ tone = 'surface' }: { tone?: ControlTone }) {
  const { locale, setLocale, t } = useI18n();
  const chrome = tone === 'chrome';

  return (
    <div
      className={`inline-flex h-9 items-center rounded-sm border p-0.5 ${
        chrome
          ? 'border-cinema-line bg-cinema-700'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
      }`}
      role="group"
      aria-label={t('language.label')}
    >
      <span
        className={`px-1.5 ${chrome ? 'console-chrome-muted' : 'text-slate-400'}`}
        aria-hidden="true"
      >
        ◎
      </span>
      {SUPPORTED_LOCALES.map((supportedLocale) => (
        <button
          key={supportedLocale}
          type="button"
          className={`min-w-8 rounded-sm px-1.5 py-1 text-[10px] font-bold transition focus-visible:outline-2 ${
            chrome ? 'focus-visible:outline-cinema-accent' : 'focus-visible:outline-amber-600'
          } ${
            locale === supportedLocale
              ? chrome
                ? 'bg-cinema-accent text-cinema-900'
                : 'bg-amber-700 dark:bg-amber-400 text-white dark:text-slate-950'
              : chrome
                ? 'console-chrome-muted hover:text-white'
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
