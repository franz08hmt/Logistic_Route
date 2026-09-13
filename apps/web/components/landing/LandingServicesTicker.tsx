'use client';

import {
  ArrowsRightLeftIcon,
  BanknotesIcon,
  GlobeAsiaAustraliaIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/i18n';

const SERVICES: ReadonlyArray<{
  id: string;
  titleKey: TranslationKey;
  noteKey: TranslationKey;
  Icon: typeof TruckIcon;
}> = [
  {
    id: 'road',
    titleKey: 'landing.services.road.title',
    noteKey: 'landing.services.road.note',
    Icon: TruckIcon,
  },
  {
    id: 'hub',
    titleKey: 'landing.services.hub.title',
    noteKey: 'landing.services.hub.note',
    Icon: ArrowsRightLeftIcon,
  },
  {
    id: 'cod',
    titleKey: 'landing.services.cod.title',
    noteKey: 'landing.services.cod.note',
    Icon: BanknotesIcon,
  },
  {
    id: 'eco',
    titleKey: 'landing.services.eco.title',
    noteKey: 'landing.services.eco.note',
    Icon: GlobeAsiaAustraliaIcon,
  },
];

/**
 * Service row laid over the foot of the hero photograph.
 *
 * The reference theme floats this row on the image itself, separated only by
 * thin vertical rules, with the icon trailing the label. There is no band
 * behind it, so the photograph carries straight through; a `backdrop-blur`
 * keeps the labels legible over whatever part of the image sits beneath.
 */
export function LandingServicesTicker() {
  const { t } = useI18n();

  return (
    <section aria-labelledby="services-title" className="mx-auto w-full max-w-7xl px-6 sm:px-8">
      <h2 id="services-title" className="sr-only">
        {t('landing.services.title')}
      </h2>
      <ul className="grid grid-cols-1 border-t border-white/15 sm:grid-cols-2 xl:grid-cols-4">
        {SERVICES.map(({ id, titleKey, noteKey, Icon }) => (
          <li
            key={id}
            className="border-white/15 sm:[&:nth-child(2)]:border-l xl:border-l xl:first:border-l-0"
          >
            <article className="group flex h-full items-center justify-between gap-5 px-2 py-7 transition-colors sm:px-6">
              <div className="min-w-0">
                <h3 className="text-[13px] font-bold uppercase tracking-[0.16em] text-amber-400">
                  {t(titleKey)}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                  {t(noteKey)}
                </p>
              </div>
              <Icon
                aria-hidden="true"
                className="h-10 w-10 shrink-0 text-white/80 transition-colors group-hover:text-amber-400"
                strokeWidth={0.9}
              />
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
