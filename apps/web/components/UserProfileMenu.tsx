'use client';

import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';

export function UserProfileMenu() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  if (!user) {
    return null;
  }

  return (
    <details className="group relative">
      <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-full bg-amber-700 dark:bg-amber-400 text-sm font-bold text-white dark:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600" aria-label={t('driver.profileMenu')}>
        {user.full_name.charAt(0).toUpperCase()}
      </summary>
      <div className="absolute right-0 z-[1200] mt-2 w-72 rounded-sm border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-2 pb-3 dark:border-slate-800">
          <small className="font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400">{t('driver.account')}</small>
          <strong className="mt-1 block truncate text-sm text-slate-950 dark:text-white">{user.full_name}</strong>
          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</span>
        </div>
        <div className="flex items-center justify-between gap-3 px-2 py-3">
          <span className="rounded-sm bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">{user.role}</span>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <button className="flex w-full items-center justify-center rounded-sm border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-amber-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800" type="button" onClick={() => void logout()}>
          {t('navigation.logout')}
        </button>
      </div>
    </details>
  );
}
