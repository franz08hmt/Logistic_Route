'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { useI18n } from '@/context/I18nContext';

/**
 * Full-bleed cinematic opener for the public portal.
 *
 * The photograph is a real `next/image` rather than a CSS background so it can
 * be optimised, sized per breakpoint and given descriptive alt text — it is the
 * page's primary image and doubles as the OpenGraph card.
 *
 * `children` render at the foot of the same positioned container, which is how
 * the service row comes to sit over the photograph rather than on a band below
 * it. They stay their own element, so the document outline is unaffected.
 */
export function LandingHero({ children }: { children?: ReactNode }) {
  const { t } = useI18n();

  return (
    <div className="relative isolate flex min-h-[640px] flex-col justify-end overflow-hidden lg:min-h-[88vh]">
      <Image
        src="/landing/hero-freight.webp"
        alt={t('landing.hero.imageAlt')}
        fill
        priority
        sizes="100vw"
        className="-z-10 object-cover object-center"
      />
      <div className="landing-hero-scrim absolute inset-0 -z-10" aria-hidden="true" />

      <section
        aria-labelledby="hero-title"
        className="mx-auto w-full max-w-7xl px-6 pb-16 pt-40 sm:px-8 lg:pb-20"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-300 sm:text-sm">
          {t('landing.hero.eyebrow')}
        </p>

        <h1
          id="hero-title"
          className="mt-5 max-w-4xl text-balance font-extrabold uppercase leading-[0.95] tracking-tight text-white"
        >
          <span className="block text-4xl sm:text-6xl lg:text-7xl">
            {t('landing.hero.titleLine1')}
          </span>
          <span className="mt-3 block text-lg font-semibold tracking-[0.08em] text-slate-200 sm:text-2xl lg:text-3xl">
            {t('landing.hero.titleLine2')}
          </span>
        </h1>

        <p className="mt-6 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
          {t('landing.hero.tagline')}
        </p>
      </section>

      {children}
    </div>
  );
}
