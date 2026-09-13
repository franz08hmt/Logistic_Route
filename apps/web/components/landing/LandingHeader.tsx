'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Bars3Icon,
  ChatBubbleLeftRightIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  ShoppingBagIcon,
  TruckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/i18n';

const NAV_LINKS: ReadonlyArray<{ href: string; labelKey: TranslationKey }> = [
  { href: '/', labelKey: 'landing.nav.home' },
  { href: '/dispatch', labelKey: 'landing.nav.dispatch' },
  { href: '/fleet', labelKey: 'landing.nav.fleet' },
  { href: '/admin/cod', labelKey: 'landing.nav.cod' },
  { href: '/orders', labelKey: 'landing.nav.tracking' },
  { href: '/analytics', labelKey: 'landing.nav.analytics' },
];

/** Heroicons ships no brand marks, so each channel uses a semantic icon plus a label. */
const SOCIAL_LINKS: ReadonlyArray<{
  href: string;
  labelKey: TranslationKey;
  Icon: typeof ChatBubbleLeftRightIcon;
}> = [
  { href: 'https://zalo.me', labelKey: 'landing.social.zalo', Icon: ChatBubbleLeftRightIcon },
  { href: 'tel:19001234', labelKey: 'landing.social.hotline', Icon: PhoneIcon },
  { href: 'https://facebook.com', labelKey: 'landing.social.facebook', Icon: GlobeAltIcon },
];

export function LandingHeader() {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="absolute inset-x-0 top-0 z-30 border-b border-white/10 bg-black/25 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-4 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-400"
        >
          <TruckIcon aria-hidden="true" className="h-8 w-8 text-amber-400" />
          <span className="leading-tight">
            <strong className="block text-lg font-extrabold tracking-[0.12em] text-white">
              {t('landing.brand')}
            </strong>
            <small className="block text-[9px] font-medium uppercase tracking-[0.22em] text-slate-300">
              {t('landing.brandSub')}
            </small>
          </span>
        </Link>

        <nav aria-label="Primary" className="ml-auto hidden xl:block">
          <ul className="flex items-center gap-7">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="border-b-2 border-transparent pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200 transition-colors hover:border-amber-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-400"
                >
                  {t(link.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-3 xl:ml-6">
          <p className="hidden items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-300 2xl:flex">
            {t('landing.followUs')}
          </p>
          <ul className="hidden items-center gap-1 2xl:flex">
            {SOCIAL_LINKS.map(({ href, labelKey, Icon }) => (
              <li key={labelKey}>
                <a
                  href={href}
                  aria-label={t(labelKey)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                >
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </a>
              </li>
            ))}
          </ul>

          <Link
            href="/orders"
            aria-label={t('landing.action.search')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            <MagnifyingGlassIcon aria-hidden="true" className="h-5 w-5" />
          </Link>

          <Link
            href="/orders"
            aria-label={t('landing.action.orders')}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            <ShoppingBagIcon aria-hidden="true" className="h-5 w-5" />
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-slate-900">
              0
            </span>
          </Link>

          <Link
            href="/login"
            className="hidden h-9 items-center rounded-full border border-white/25 px-4 text-[10px] font-bold uppercase tracking-[0.18em] text-white transition-colors hover:bg-white hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 lg:inline-flex"
          >
            {t('landing.action.dashboard')}
          </Link>

          <button
            type="button"
            aria-label={menuOpen ? t('landing.action.closeMenu') : t('landing.action.menu')}
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-nav"
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 xl:hidden"
          >
            {menuOpen ? (
              <XMarkIcon aria-hidden="true" className="h-6 w-6" />
            ) : (
              <Bars3Icon aria-hidden="true" className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      <nav
        id="landing-mobile-nav"
        aria-label="Mobile"
        hidden={!menuOpen}
        className="border-t border-white/10 bg-black/80 backdrop-blur-lg xl:hidden"
      >
        <ul className="mx-auto flex max-w-7xl flex-col px-6 py-2 sm:px-8">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="block border-b border-white/5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 hover:text-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                {t(link.labelKey)}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="mt-3 mb-3 inline-flex h-11 items-center rounded-full border border-white/25 px-5 text-[11px] font-bold uppercase tracking-[0.18em] text-white hover:bg-white hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              {t('landing.action.dashboard')}
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
