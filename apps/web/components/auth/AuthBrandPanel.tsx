'use client';

import { useI18n } from '@/context/I18nContext';

export function AuthBrandPanel({ headingId }: { headingId: string }) {
  const { t } = useI18n();

  return (
    <section
      className="relative hidden overflow-hidden bg-teal-700 p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16"
      aria-labelledby={headingId}
    >
      <div className="absolute inset-0 opacity-20" aria-hidden="true">
        <svg className="h-full w-full" viewBox="0 0 800 900" fill="none">
          <path d="M-80 720C120 640 166 390 356 402s190 224 530 82" stroke="white" strokeWidth="2" strokeDasharray="8 12" />
          <path d="M80 124h640M80 264h640M80 404h640M80 544h640M80 684h640" stroke="white" strokeOpacity=".2" />
          <circle cx="356" cy="402" r="12" fill="white" />
          <circle cx="608" cy="528" r="12" fill="white" />
        </svg>
      </div>

      <div className="relative flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-white text-sm font-black text-teal-700 shadow-sm">LR</span>
        <span>
          <strong className="block text-base">LogiRoute VN</strong>
          <small className="text-xs font-medium uppercase tracking-[0.18em] text-teal-100">{t('common.appTagline')}</small>
        </span>
      </div>

      <div className="relative max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-100">{t('auth.platform')}</p>
        <h2 id={headingId} className="mt-5 text-5xl font-semibold leading-tight tracking-tight xl:text-6xl">
          {t('auth.heroTitle')}
        </h2>
        <p className="mt-6 max-w-xl text-base leading-7 text-teal-50/85">
          {t('auth.heroDescription')}
        </p>
      </div>

      <div className="relative flex items-center gap-2 text-sm text-teal-50">
        <span className="size-2 rounded-full bg-emerald-300 ring-4 ring-emerald-200/20" aria-hidden="true" />
        {t('auth.systemReady')}
      </div>
    </section>
  );
}
