'use client';

import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/i18n';
import type {
  OrderActivity,
  OrderActivityAction,
} from './activity-contracts';
import { ORDER_STATUSES, type OrderStatus } from './api-contracts';

const actionLabelKeys: Record<OrderActivityAction, TranslationKey> = {
  CREATED: 'activity.CREATED',
  STATUS_CHANGED: 'activity.STATUS_CHANGED',
  ASSIGNED: 'activity.ASSIGNED',
  POD_UPLOADED: 'activity.POD_UPLOADED',
  SIGNATURE_UPLOADED: 'activity.SIGNATURE_UPLOADED',
  IMPORTED: 'activity.IMPORTED',
};

const dotStyles: Record<OrderActivityAction, string> = {
  CREATED: 'border-teal-200 bg-teal-500 dark:border-teal-900',
  ASSIGNED: 'border-sky-200 bg-sky-500 dark:border-sky-900',
  STATUS_CHANGED: 'border-amber-200 bg-amber-500 dark:border-amber-900',
  POD_UPLOADED: 'border-violet-200 bg-violet-500 dark:border-violet-900',
  SIGNATURE_UPLOADED: 'border-fuchsia-200 bg-fuchsia-500 dark:border-fuchsia-900',
  IMPORTED: 'border-slate-300 bg-slate-500 dark:border-slate-700',
};

function statusLabelKey(status: string | null): TranslationKey | null {
  if (!status || !ORDER_STATUSES.includes(status as OrderStatus)) {
    return null;
  }
  return `status.${status}` as TranslationKey;
}

function activityDotStyle(activity: OrderActivity): string {
  if (activity.action !== 'STATUS_CHANGED') {
    return dotStyles[activity.action];
  }
  if (activity.new_status === 'DELIVERED') {
    return 'border-emerald-200 bg-emerald-500 dark:border-emerald-900';
  }
  if (activity.new_status === 'FAILED') {
    return 'border-rose-200 bg-rose-500 dark:border-rose-900';
  }
  return dotStyles.STATUS_CHANGED;
}

export function OrderActivityTimeline({
  activities,
  isLoading,
  error,
}: {
  activities: OrderActivity[];
  isLoading: boolean;
  error: string | null;
}) {
  const { locale, t } = useI18n();
  const dateFormatter = new Intl.DateTimeFormat(
    locale === 'vi' ? 'vi-VN' : 'en-US',
    { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' },
  );

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label={t('activity.loading')}>
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300" role="alert">{error}</p>;
  }

  if (activities.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-700" role="status">{t('activity.empty')}</p>;
  }

  return (
    <ol className="relative ml-2 border-l border-slate-200 pl-6 dark:border-slate-700">
      {activities.map((activity, index) => {
        const newStatusKey = statusLabelKey(activity.new_status);
        const roleKey = activity.actor_role
          ? `admin.users.role.${activity.actor_role}` as TranslationKey
          : null;
        return (
          <li key={activity.id} className={index < activities.length - 1 ? 'pb-7' : ''}>
            <span className={`absolute -left-2 mt-1.5 size-4 rounded-full border-4 border-white dark:border-slate-900 ${activityDotStyle(activity)}`} aria-hidden="true" />
            <time className="text-xs font-medium text-slate-500" dateTime={activity.created_at}>
              {dateFormatter.format(new Date(activity.created_at))}
            </time>
            <h4 className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
              {activity.action === 'STATUS_CHANGED' && newStatusKey
                ? t('activity.statusChangedTo', { status: t(newStatusKey) })
                : t(actionLabelKeys[activity.action])}
            </h4>
            {activity.detail && <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{activity.detail}</p>}
            <p className="mt-1 text-xs text-slate-500">
              {activity.actor_name
                ? t('activity.actor', {
                    name: activity.actor_name,
                    role: roleKey ? t(roleKey) : activity.actor_role || t('activity.unknownRole'),
                  })
                : t('activity.systemActor')}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
