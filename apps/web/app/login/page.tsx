'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';

import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/i18n';

const demoAccounts = [
  { role: 'ADMIN', labelKey: 'auth.admin', email: 'admin@logiroute.vn', password: '123456' },
  { role: 'DISPATCHER', labelKey: 'auth.dispatcher', email: 'dispatcher@logiroute.vn', password: '123456' },
  { role: 'DRIVER', labelKey: 'auth.driver', email: 'driver1@logiroute.vn', password: '123456' },
] satisfies Array<{
  role: keyof typeof roleStyles;
  labelKey: TranslationKey;
  email: string;
  password: string;
}>;

const roleStyles = {
  ADMIN: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  DISPATCHER: 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300',
  DRIVER: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
} as const;

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState('dispatcher@logiroute.vn');
  const [password, setPassword] = useState('123456');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await login({ email, password });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t('auth.loginError'),
      );
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-slate-50 dark:bg-slate-950 lg:grid-cols-[minmax(0,1.05fr)_minmax(480px,.95fr)]">
      <AuthBrandPanel headingId="login-heading" />

      <section className="relative flex min-h-screen items-center justify-center px-4 py-12 sm:px-8" aria-label={t('auth.loginRegion')}>
        <div className="absolute right-4 top-4 flex items-center gap-2 sm:right-8 sm:top-6">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md">
          <div className="mb-9 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-teal-600 text-xs font-black text-white">LR</span>
            <span>
              <strong className="block text-sm text-slate-950 dark:text-white">LogiRoute VN</strong>
              <small className="text-xs text-slate-500">{t('common.appTagline')}</small>
            </span>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-400">{t('auth.secureAccess')}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{t('auth.welcomeBack')}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{t('auth.loginDescription')}</p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="login-email">
              {t('auth.email')}
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 block h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-teal-500"
                required
              />
            </label>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="login-password">
              {t('auth.password')}
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 block h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-teal-500"
                required
              />
            </label>

            {error && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300" role="alert">
                {error}
              </p>
            )}

            <button
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-60"
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting && <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />}
              {isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
            </button>
          </form>

          <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-800">
            <div className="mb-3 flex items-center justify-between gap-4">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t('auth.demoAccounts')}</span>
              <small className="text-xs text-slate-500">{t('auth.quickFill')}</small>
            </div>
            <div className="space-y-2">
              {demoAccounts.map((account) => (
                <button
                  key={account.role}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-teal-300 hover:bg-teal-50/40 focus-visible:outline-2 focus-visible:outline-teal-600 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-800 dark:hover:bg-teal-950/30"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.password);
                    setError(null);
                  }}
                >
                  <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${roleStyles[account.role]}`}>{account.role}</span>
                  <span className="min-w-0">
                    <strong className="block text-sm text-slate-800 dark:text-slate-200">{t(account.labelKey)}</strong>
                    <small className="block truncate text-xs text-slate-500">{account.email}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            {t('auth.noAccount')}{' '}
            <Link className="font-semibold text-teal-700 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300" href="/register">
              {t('auth.register')}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
