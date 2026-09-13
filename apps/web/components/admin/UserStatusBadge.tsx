'use client';

import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/i18n';
import type { UserStatus } from '@/lib/auth/contracts';

const statusStyles: Record<UserStatus, string> = {
  PENDING_APPROVAL: 'bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-950/50 dark:text-orange-300',
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300',
  SUSPENDED: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-950/50 dark:text-rose-300',
};

const statusKeys: Record<UserStatus, TranslationKey> = {
  PENDING_APPROVAL: 'admin.users.status.pending',
  ACTIVE: 'admin.users.status.active',
  SUSPENDED: 'admin.users.status.suspended',
};

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const { t } = useI18n();

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyles[status]}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {t(statusKeys[status])}
    </span>
  );
}
