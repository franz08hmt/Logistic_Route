'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';
import { type UserRole } from '@/lib/auth/contracts';

type RoleGuardProps = {
  allowedRoles: UserRole[];
  redirectTo: string;
  children: ReactNode;
};

export function RoleGuard({ allowedRoles, redirectTo, children }: RoleGuardProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user && !allowedRoles.includes(user.role)) {
      router.replace(redirectTo);
    }
  }, [allowedRoles, isLoading, redirectTo, router, user]);

  if (isLoading) {
    return <p className="page-loading" role="status" aria-busy="true">Đang kiểm tra quyền truy cập…</p>;
  }

  if (!user || !allowedRoles.includes(user.role)) {
    return <p className="page-loading" role="status">Đang chuyển hướng…</p>;
  }

  return <>{children}</>;
}
