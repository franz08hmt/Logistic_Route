'use client';

import { TruckIcon } from '@heroicons/react/24/outline';

import { useI18n } from '@/context/I18nContext';

/**
 * Brand half of the sign-in screen.
 *
 * Sign-in is the hinge between the public portal and the console, so it takes
 * the portal's ground rather than a saturated brand slab. The previous amber
 * block also put its body copy at 3.42:1; on the cinema ground the same copy
 * clears AA with room to spare, even under the decorative pattern.
 */
export function AuthBrandPanel({ headingId }: { headingId: string }) {
  const { t } = useI18n();

  return (
    <section
      className="relative hidden overflow-hidden bg-cinema-900 p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16"
      aria-labelledby={headingId}
    >
      <div className="absolute inset-0 opacity-[0.18]" aria-hidden="true">
        <svg className="h-full w-full" viewBox="0 0 800 900" fill="none">
          <path
            d="M-80 720C120 640 166 390 356 402s190 224 530 82"
            stroke="#e8a838"
            strokeWidth="2"
            strokeDasharray="8 12"
          />
          <path
            d="M80 124h640M80 264h640M80 404h640M80 544h640M80 684h640"
            stroke="white"
            strokeOpacity=".14"
          />
          <circle cx="356" cy="402" r="12" fill="#e8a838" />
          <circle cx="608" cy="528" r="12" fill="#e8a838" />
        </svg>
      </div>

      <div className="relative flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-sm bg-cinema-accent text-cinema-900">
          <TruckIcon aria-hidden="true" className="size-6" strokeWidth={1.4} />
        </span>
        <span className="leading-tight">
          <strong className="block text-base font-extrabold tracking-[0.1em]">
            LogiRoute VN
          </strong>
          <small className="block text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">
            {t('common.appTagline')}
          </small>
        </span>
      </div>

      <div className="relative max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
          {t('auth.platform')}
        </p>
        <h2
          id={headingId}
          className="mt-5 text-4xl font-extrabold uppercase leading-[1.05] tracking-wider xl:text-5xl"
        >
          {t('auth.heroTitle')}
        </h2>
        <hr className="mt-6 w-24 border-t border-white/25" />
        <p className="mt-6 max-w-xl text-base leading-7 text-slate-300">
          {t('auth.heroDescription')}
        </p>
      </div>

      <p className="relative flex items-center gap-2 text-sm text-slate-300">
        <span
          className="size-2 rounded-full bg-emerald-400 ring-4 ring-emerald-400/15"
          aria-hidden="true"
        />
        {t('auth.systemReady')}
      </p>
    </section>
  );
}
