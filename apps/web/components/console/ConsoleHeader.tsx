'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowRightStartOnRectangleIcon,
  Bars3Icon,
  BanknotesIcon,
  BuildingStorefrontIcon,
  ChartBarIcon,
  CubeIcon,
  IdentificationIcon,
  MagnifyingGlassIcon,
  MapIcon,
  ServerStackIcon,
  Squares2X2Icon,
  TruckIcon,
  UsersIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/i18n';

import { DepotSwitcher } from '../DepotSwitcher';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { ThemeToggle } from '../ThemeToggle';

/**
 * Console navigation, built as the portal's header rather than an admin rail.
 *
 * Moving from a left sidebar to this bar is what closes the gap between the
 * public page and the console: the same logo block, the same wide uppercase
 * links, the same tool cluster on the right. Clicking through from the landing
 * no longer swaps one navigation model for another.
 */

type NavLink = { href: string; labelKey: TranslationKey; Icon: typeof TruckIcon };

const OPERATIONS: ReadonlyArray<NavLink> = [
  { href: '/dashboard', labelKey: 'navigation.dashboard', Icon: Squares2X2Icon },
  { href: '/orders', labelKey: 'navigation.orders', Icon: CubeIcon },
  { href: '/dispatch', labelKey: 'navigation.dispatch', Icon: MapIcon },
  { href: '/fleet', labelKey: 'navigation.fleet', Icon: TruckIcon },
  { href: '/drivers', labelKey: 'navigation.drivers', Icon: IdentificationIcon },
  { href: '/analytics', labelKey: 'navigation.analytics', Icon: ChartBarIcon },
];

const COD: NavLink = {
  href: '/admin/cod',
  labelKey: 'navigation.cod',
  Icon: BanknotesIcon,
};

/** Administration lives in the profile menu so the bar keeps the portal's rhythm. */
const ADMIN: ReadonlyArray<NavLink> = [
  { href: '/admin/users', labelKey: 'navigation.users', Icon: UsersIcon },
  { href: '/admin/depots', labelKey: 'navigation.depots', Icon: BuildingStorefrontIcon },
  { href: '/admin/system', labelKey: 'navigation.system', Icon: ServerStackIcon },
];

const DRIVER: ReadonlyArray<NavLink> = [
  { href: '/driver', labelKey: 'navigation.driverRoute', Icon: IdentificationIcon },
];

function primaryLinks(role: string | undefined): ReadonlyArray<NavLink> {
  if (role === 'DRIVER') return DRIVER;
  if (role === 'ADMIN' || role === 'DISPATCHER') return [...OPERATIONS, COD];
  return OPERATIONS;
}

export function ConsoleHeader() {
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = primaryLinks(user?.role);
  const adminLinks = user?.role === 'ADMIN' ? ADMIN : [];
  const isDriver = user?.role === 'DRIVER';

  return (
    <header className="console-chrome sticky top-0 z-[1000] border-b">
      <div className="mx-auto flex max-w-[100rem] items-center gap-4 px-6 py-3 sm:px-8">
        <Link
          href={isDriver ? '/driver' : '/dashboard'}
          className="flex shrink-0 items-center gap-3 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cinema-accent"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-sm bg-cinema-accent text-cinema-900">
            <TruckIcon aria-hidden="true" className="size-5" strokeWidth={1.5} />
          </span>
          <span className="leading-tight">
            <strong className="block text-sm font-extrabold tracking-[0.12em] text-white">
              LOGIROUTE
            </strong>
            <small className="console-chrome-muted block text-[9px] font-medium uppercase tracking-[0.2em]">
              {t('common.appTagline')}
            </small>
          </span>
        </Link>

        <nav aria-label={t('navigation.main')} className="ml-auto hidden xl:block">
          <ul className="flex items-center gap-5 2xl:gap-6">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={`whitespace-nowrap border-b-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors 2xl:tracking-[0.18em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cinema-accent ${
                      active
                        ? 'border-cinema-accent text-cinema-accent'
                        : 'border-transparent text-slate-300 hover:border-cinema-accent hover:text-white'
                    }`}
                  >
                    {t(link.labelKey)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 xl:ml-6">
          {!isDriver && (
            <div className="hidden 2xl:block">
              <DepotSwitcher compact />
            </div>
          )}

          <Link
            href="/orders"
            aria-label={t('landing.action.search')}
            className="hidden size-9 items-center justify-center rounded-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cinema-accent 2xl:inline-flex"
          >
            <MagnifyingGlassIcon aria-hidden="true" className="size-5" />
          </Link>

          <div className="hidden sm:block">
            <LanguageSwitcher tone="chrome" />
          </div>
          <ThemeToggle tone="chrome" />

          {isLoading ? (
            <span
              className="size-9 animate-pulse rounded-sm bg-white/10"
              aria-label={t('navigation.loadingSession')}
              aria-busy="true"
            />
          ) : user ? (
            <details className="relative">
              <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-sm bg-cinema-accent/15 text-sm font-bold text-cinema-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cinema-accent">
                <span className="sr-only">{user.full_name}</span>
                <span aria-hidden="true">{user.full_name.charAt(0).toUpperCase()}</span>
              </summary>
              <div className="console-chrome absolute right-0 top-11 z-50 w-64 border p-4">
                <p className="min-w-0">
                  <strong className="block truncate text-sm font-semibold text-white">
                    {user.full_name}
                  </strong>
                  <small className="console-chrome-muted block truncate text-xs">
                    {user.email}
                  </small>
                </p>
                <p className="mt-3">
                  <span className="rounded-sm bg-cinema-accent/15 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-cinema-accent">
                    {user.role}
                  </span>
                </p>

                {adminLinks.length > 0 && (
                  <ul className="mt-4 space-y-1 border-t border-cinema-line pt-3">
                    {adminLinks.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          aria-current={pathname === link.href ? 'page' : undefined}
                          className={`flex items-center gap-2.5 rounded-sm px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                            pathname === link.href
                              ? 'bg-cinema-accent/12 text-cinema-accent'
                              : 'text-slate-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <link.Icon aria-hidden="true" className="size-4" />
                          {t(link.labelKey)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  type="button"
                  onClick={() => void logout()}
                  className="console-chrome-muted mt-3 inline-flex w-full items-center gap-2 border-t border-cinema-line px-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors hover:text-white"
                >
                  <ArrowRightStartOnRectangleIcon aria-hidden="true" className="size-4" />
                  {t('navigation.logout')}
                </button>
              </div>
            </details>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-9 items-center rounded-sm border border-white/25 px-4 text-[10px] font-bold uppercase tracking-[0.18em] text-white transition-colors hover:bg-white hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cinema-accent"
            >
              {t('navigation.login')}
            </Link>
          )}

          <button
            type="button"
            aria-label={menuOpen ? t('landing.action.closeMenu') : t('landing.action.menu')}
            aria-expanded={menuOpen}
            aria-controls="console-mobile-nav"
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex size-10 items-center justify-center rounded-sm text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cinema-accent xl:hidden"
          >
            {menuOpen ? (
              <XMarkIcon aria-hidden="true" className="size-6" />
            ) : (
              <Bars3Icon aria-hidden="true" className="size-6" />
            )}
          </button>
        </div>
      </div>

      <nav
        id="console-mobile-nav"
        aria-label={t('navigation.mobile')}
        hidden={!menuOpen}
        className="console-chrome border-t xl:hidden"
      >
        <ul className="mx-auto flex max-w-[100rem] flex-col px-6 py-2 sm:px-8">
          {[...links, ...adminLinks].map((link) => {
            const active = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 border-b border-white/5 py-3.5 text-xs font-semibold uppercase tracking-[0.16em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cinema-accent ${
                    active ? 'text-cinema-accent' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <link.Icon aria-hidden="true" className="size-4.5" />
                  {t(link.labelKey)}
                </Link>
              </li>
            );
          })}
          {!isDriver && (
            <li className="py-3">
              <DepotSwitcher />
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
}
