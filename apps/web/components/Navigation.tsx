'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/i18n';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { UserProfileMenu } from './UserProfileMenu';

type NavIconName = 'dashboard' | 'orders' | 'fleet' | 'map' | 'driver' | 'users';

const adminLinks = [
  { labelKey: 'navigation.dashboard', href: '/dashboard', icon: 'dashboard' },
  { labelKey: 'navigation.orders', href: '/orders', icon: 'orders' },
  { labelKey: 'navigation.fleet', href: '/fleet', icon: 'fleet' },
  { labelKey: 'navigation.dispatch', href: '/map', icon: 'map' },
] satisfies Array<{ labelKey: TranslationKey; href: string; icon: NavIconName }>;

const driverLinks = [
  { labelKey: 'navigation.driverRoute', href: '/driver', icon: 'driver' },
] satisfies Array<{ labelKey: TranslationKey; href: string; icon: NavIconName }>;

const userManagementLink = {
  labelKey: 'navigation.users',
  href: '/admin/users',
  icon: 'users',
} satisfies { labelKey: TranslationKey; href: string; icon: NavIconName };

function NavIcon({ name }: { name: NavIconName }) {
  const common = {
    className: 'size-5',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
    'aria-hidden': true,
  } as const;

  if (name === 'dashboard') {
    return <svg {...common}><path d="M4 4h6v6H4zM14 4h6v10h-6zM4 14h6v6H4zM14 18h6v2h-6z" /></svg>;
  }
  if (name === 'orders') {
    return <svg {...common}><path d="M6 3h12l2 4-8 4-8-4 2-4Z" /><path d="M4 7v10l8 4 8-4V7M12 11v10" /></svg>;
  }
  if (name === 'fleet') {
    return <svg {...common}><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>;
  }
  if (name === 'map') {
    return <svg {...common}><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z" /><path d="M9 3v15M15 6v15" /></svg>;
  }
  if (name === 'users') {
    return <svg {...common}><path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 20v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
  }
  return <svg {...common}><path d="M5 19h14M7 17v-6l5-7 5 7v6M9 12h6" /><circle cx="12" cy="9" r="1.5" /></svg>;
}

function Logo() {
  const { t } = useI18n();

  return (
    <Link className="flex items-center gap-3" href="/dashboard" aria-label="LogiRoute VN">
      <span className="grid size-9 place-items-center rounded-xl bg-teal-600 text-xs font-black tracking-tight text-white shadow-sm shadow-teal-600/20">
        LR
      </span>
      <span>
        <strong className="block text-sm font-bold tracking-tight text-slate-950 dark:text-white">
          LogiRoute VN
        </strong>
        <small className="block text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
          {t('common.appTagline')}
        </small>
      </span>
    </Link>
  );
}

export function Navigation() {
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();
  const { t } = useI18n();
  const links =
    user?.role === 'DRIVER'
      ? driverLinks
      : user?.role === 'ADMIN' || user?.role === 'DISPATCHER'
        ? [...adminLinks, userManagementLink]
        : adminLinks;

  return (
    <>
      <header className="sticky top-0 z-[1000] flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90 lg:hidden">
        <Logo />
        <div className="flex items-center gap-2">
          {user?.role === 'DRIVER' ? (
            <UserProfileMenu />
          ) : (
            <>
              <LanguageSwitcher />
              <ThemeToggle />
            </>
          )}
        </div>
      </header>

      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-slate-200 bg-white px-4 py-5 dark:border-slate-800 dark:bg-slate-950 lg:flex">
        <div className="px-2"><Logo /></div>
        <div className="mt-5 flex items-center justify-between px-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        <nav className="mt-6 space-y-1" aria-label={t('navigation.main')}>
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white'
                }`}
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
              >
                <NavIcon name={link.icon} />
                {t(link.labelKey)}
                {active && <span className="ml-auto size-1.5 rounded-full bg-teal-600" aria-hidden="true" />}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-slate-200 pt-4 dark:border-slate-800">
          {isLoading ? (
            <div className="space-y-2 px-2" aria-label={t('navigation.loadingSession')} aria-busy="true">
              <span className="block h-9 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-900" />
              <span className="block h-4 w-2/3 animate-pulse rounded bg-slate-100 dark:bg-slate-900" />
            </div>
          ) : user ? (
            <div className="space-y-3">
              <div className="flex min-w-0 items-center gap-3 px-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {user.full_name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <strong className="block truncate text-sm text-slate-900 dark:text-white">{user.full_name}</strong>
                  <small className="block truncate text-xs text-slate-500">{user.email}</small>
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 px-2">
                <span className="rounded-md bg-teal-50 px-2 py-1 text-[10px] font-bold tracking-wide text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                  {user.role}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="rounded-lg px-2 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-teal-600 dark:hover:bg-slate-900 dark:hover:text-white"
                    onClick={() => void logout()}
                  >
                    {t('navigation.logout')}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <Link className="block rounded-xl bg-teal-600 px-3 py-2.5 text-center text-sm font-semibold text-white hover:bg-teal-700" href="/login">
              {t('navigation.login')}
            </Link>
          )}
        </div>
      </aside>

      <nav
        className={`fixed inset-x-0 bottom-0 z-[1000] grid border-t border-slate-200 bg-white/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 lg:hidden ${
          links.length === 1
            ? 'grid-cols-1'
            : links.length === 5
              ? 'grid-cols-5'
              : 'grid-cols-4'
        }`}
        aria-label={t('navigation.mobile')}
      >
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-semibold ${
                active ? 'text-teal-700 dark:text-teal-300' : 'text-slate-500 dark:text-slate-400'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <NavIcon name={link.icon} />
              {t(link.labelKey)}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
