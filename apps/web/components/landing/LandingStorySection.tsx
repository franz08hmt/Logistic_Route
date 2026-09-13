'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/i18n';

const STATS: ReadonlyArray<{ value: string; labelKey: TranslationKey }> = [
  { value: '1.240', labelKey: 'landing.story.statRoutes' },
  { value: '04', labelKey: 'landing.story.statHubs' },
  { value: '18%', labelKey: 'landing.story.statSaved' },
];

/** Asymmetric two-column story block with an oversized watermark behind it. */
export function LandingStorySection() {
  const { t } = useI18n();

  return (
    <section
      aria-labelledby="story-title"
      className="relative isolate overflow-hidden bg-cinema-900 py-20 lg:py-28"
    >
      <p
        aria-hidden="true"
        className="landing-watermark pointer-events-none absolute -left-4 top-10 -z-10 text-[7rem] sm:text-[11rem] lg:text-[15rem]"
      >
        {t('landing.story.watermark')}
      </p>

      <div className="mx-auto grid max-w-7xl gap-12 px-6 sm:px-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        {/* A layout column, not a document header: using <header> here made it
            ambiguous with the page banner for assistive technology. */}
        <div>
          <h2
            id="story-title"
            className="text-3xl font-bold uppercase tracking-wider text-white sm:text-4xl"
          >
            {t('landing.story.title')}
          </h2>
          <p className="mt-2 text-xs font-medium uppercase tracking-widest text-amber-400/90 sm:text-sm">
            {t('landing.story.subtitle')}
          </p>
          <hr className="mt-6 w-24 border-t border-white/25" />

          <dl className="mt-10 grid grid-cols-3 gap-4 lg:max-w-sm">
            {STATS.map((stat) => (
              <div key={stat.labelKey}>
                <dt className="sr-only">{t(stat.labelKey)}</dt>
                <dd>
                  <strong className="block text-2xl font-extrabold tabular-nums text-white sm:text-3xl">
                    {stat.value}
                  </strong>
                  <span className="mt-1 block text-[10px] uppercase leading-tight tracking-wider text-slate-400">
                    {t(stat.labelKey)}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="space-y-6">
          <figure className="overflow-hidden rounded-sm border border-white/10">
            <Image
              src="/landing/story-interchange.webp"
              alt={t('landing.story.imageAlt')}
              width={900}
              height={620}
              sizes="(max-width: 1024px) 100vw, 640px"
              className="h-56 w-full object-cover sm:h-72"
            />
          </figure>

          <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
            {t('landing.story.body1')}
          </p>
          <p className="text-sm leading-relaxed text-slate-400 sm:text-base">
            {t('landing.story.body2')}
          </p>

          <Link
            href="/login"
            className="group inline-flex items-center gap-3 border border-white/30 px-7 py-3.5 text-[11px] font-bold uppercase tracking-[0.2em] text-white transition-colors hover:bg-white hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-400"
          >
            {t('landing.story.cta')}
            <ChevronRightIcon aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
