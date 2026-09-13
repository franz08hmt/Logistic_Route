'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { useI18n } from '@/context/I18nContext';

/** `chrome` renders on the Dark Cinema sidebar; `surface` on a light page. */
export type ControlTone = 'surface' | 'chrome';

export function ThemeToggle({ tone = 'surface' }: { tone?: ControlTone }) {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <span
        className={`size-9 animate-pulse rounded-sm ${
          tone === 'chrome' ? 'bg-white/10' : 'bg-slate-100 dark:bg-slate-800'
        }`}
        aria-hidden="true"
      />
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      className={`inline-flex size-9 items-center justify-center rounded-sm border transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
        tone === 'chrome'
          ? 'border-cinema-line bg-cinema-700 text-slate-300 hover:border-cinema-accent hover:text-cinema-accent focus-visible:outline-cinema-accent'
          : 'border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:text-amber-700 focus-visible:outline-amber-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-amber-700 dark:hover:text-amber-300'
      }`}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? t('theme.switchLight') : t('theme.switchDark')}
      title={isDark ? t('theme.light') : t('theme.dark')}
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M20.7 15.2A8.5 8.5 0 0 1 8.8 3.3 8.5 8.5 0 1 0 20.7 15.2Z" />
        </svg>
      )}
    </button>
  );
}
