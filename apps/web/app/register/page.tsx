'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';

import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useI18n } from '@/context/I18nContext';
import {
  isRecord,
  type RegisterInput,
  type SelfRegisterRole,
} from '@/lib/auth/contracts';

const inputClassName =
  'mt-2 block h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-teal-500';

export default function RegisterPage() {
  const { t } = useI18n();
  const [form, setForm] = useState<RegisterInput>({
    full_name: '',
    email: '',
    password: '',
    phone_number: '',
    role: 'DISPATCHER',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField<Key extends keyof RegisterInput>(
    key: Key,
    value: RegisterInput[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const detail =
          response.status === 409
            ? t('register.emailExists')
            : response.status === 422
              ? t('register.invalidInput')
              : isRecord(payload) && typeof payload.detail === 'string'
                ? payload.detail
                : t('register.error');
        throw new Error(detail);
      }

      setIsComplete(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : t('register.error'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-slate-50 dark:bg-slate-950 lg:grid-cols-[minmax(0,1.05fr)_minmax(480px,.95fr)]">
      <AuthBrandPanel headingId="register-brand-heading" />

      <section className="relative flex min-h-screen items-center justify-center px-4 py-20 sm:px-8" aria-label={t('register.region')}>
        <div className="absolute right-4 top-4 flex items-center gap-2 sm:right-8 sm:top-6">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        <div className="w-full max-w-lg">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-teal-600 text-xs font-black text-white">LR</span>
            <span>
              <strong className="block text-sm text-slate-950 dark:text-white">LogiRoute VN</strong>
              <small className="text-xs text-slate-500">{t('common.appTagline')}</small>
            </span>
          </div>

          {isComplete ? (
            <div className="rounded-xl border border-emerald-200 bg-white p-7 shadow-sm dark:border-emerald-900 dark:bg-slate-900" role="status">
              <span className="grid size-12 place-items-center rounded-full bg-emerald-100 text-xl text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" aria-hidden="true">✓</span>
              <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{t('register.successTitle')}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">{t('register.successDescription')}</p>
              <Link className="mt-7 inline-flex h-11 w-full items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600" href="/login">
                {t('register.backToLogin')}
              </Link>
            </div>
          ) : (
            <>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-400">{t('register.eyebrow')}</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{t('register.title')}</h1>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{t('register.description')}</p>
              </div>

              <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="register-name">
                    {t('register.fullName')}
                    <input id="register-name" className={inputClassName} value={form.full_name} onChange={(event) => updateField('full_name', event.target.value)} autoComplete="name" required minLength={2} />
                  </label>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="register-phone">
                    {t('register.phone')} <span className="font-normal text-slate-400">({t('common.optional')})</span>
                    <input id="register-phone" className={inputClassName} value={form.phone_number ?? ''} onChange={(event) => updateField('phone_number', event.target.value)} autoComplete="tel" />
                  </label>
                </div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="register-email">
                  {t('auth.email')}
                  <input id="register-email" className={inputClassName} type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} autoComplete="email" required />
                </label>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="register-password">
                  {t('auth.password')}
                  <input id="register-password" className={inputClassName} type="password" value={form.password} onChange={(event) => updateField('password', event.target.value)} autoComplete="new-password" required minLength={6} />
                  <small className="mt-1.5 block text-xs text-slate-500">{t('register.passwordHint')}</small>
                </label>

                <fieldset>
                  <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('register.role')}</legend>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    {(['DISPATCHER', 'DRIVER'] as SelfRegisterRole[]).map((role) => (
                      <label key={role} className={`cursor-pointer rounded-xl border p-3.5 transition focus-within:ring-2 focus-within:ring-teal-600 ${form.role === role ? 'border-teal-600 bg-teal-50 ring-2 ring-teal-600/10 dark:bg-teal-950/40' : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'}`}>
                        <input className="sr-only" type="radio" name="role" value={role} checked={form.role === role} onChange={() => updateField('role', role)} />
                        <strong className="block text-sm text-slate-900 dark:text-white">{t(role === 'DISPATCHER' ? 'register.dispatcherRole' : 'register.driverRole')}</strong>
                        <small className="mt-1 block text-xs leading-5 text-slate-500">{t(role === 'DISPATCHER' ? 'register.dispatcherHelp' : 'register.driverHelp')}</small>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300" role="alert">{error}</p>}

                <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-60" type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
                  {isSubmitting && <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />}
                  {isSubmitting ? t('register.submitting') : t('register.submit')}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
                {t('register.hasAccount')}{' '}
                <Link className="font-semibold text-teal-700 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300" href="/login">{t('auth.signIn')}</Link>
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
