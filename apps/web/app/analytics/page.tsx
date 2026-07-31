import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';
import { AppShell } from '@/components/AppShell';
import { LocalizedPageHeader } from '@/components/LocalizedPageHeader';
import { RoleGuard } from '@/components/RoleGuard';

export default function AnalyticsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <RoleGuard allowedRoles={['ADMIN', 'DISPATCHER']} redirectTo="/driver">
          <LocalizedPageHeader
            eyebrowKey="analytics.eyebrow"
            titleKey="analytics.title"
            descriptionKey="analytics.description"
          />
          <AnalyticsDashboard />
        </RoleGuard>
      </div>
    </AppShell>
  );
}
