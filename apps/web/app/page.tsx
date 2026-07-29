'use client';

import { DashboardOverview } from '@/components/DashboardOverview';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { useI18n } from '@/context/I18nContext';
import Link from 'next/link';

export default function HomePage() {
  const { t } = useI18n();

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          eyebrow={t('home.eyebrow')}
          title={t('home.title')}
          description={t('home.description')}
          action={(
            <Link className="inline-flex h-10 items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700" href="/dashboard">
              {t('home.openDashboard')}
            </Link>
          )}
        />
        <DashboardOverview />
      </div>
    </AppShell>
  );
}
