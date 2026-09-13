'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { type UserRole } from '@/lib/auth/contracts';

type RoleGuardProps = {
  allowedRoles: UserRole[];
  redirectTo: string;
  children: ReactNode;
};

export function RoleGuard({ allowedRoles, redirectTo, children }: RoleGuardProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { t } = useI18n();

  useEffect(() => {
    if (!isLoading && user && !allowedRoles.includes(user.role)) {
      router.replace(redirectTo);
    }
  }, [allowedRoles, isLoading, redirectTo, router, user]);

  if (isLoading) {
    return (
      <div className="grid min-h-56 place-items-center" role="status" aria-busy="true">
        <span className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-amber-600" aria-hidden="true" />
          {t('guard.checking')}
        </span>
      </div>
    );
  }

  if (!user || !allowedRoles.includes(user.role)) {
    return <p className="py-16 text-center text-sm text-slate-500 dark:text-slate-400" role="status">{t('guard.redirecting')}</p>;
  }

  return <>{children}</>;
}
