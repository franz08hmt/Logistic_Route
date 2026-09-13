import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';
import { AppShell, ConsoleSection } from '@/components/AppShell';
import { LocalizedPageHeader } from '@/components/LocalizedPageHeader';
import { RoleGuard } from '@/components/RoleGuard';

export default function AnalyticsPage() {
  return (
    <AppShell>
      <RoleGuard allowedRoles={['ADMIN', 'DISPATCHER']} redirectTo="/driver">
        <LocalizedPageHeader
          eyebrowKey="analytics.eyebrow"
          titleKey="analytics.title"
          descriptionKey="analytics.description"
        />
        <ConsoleSection>
          <AnalyticsDashboard />
        </ConsoleSection>
      </RoleGuard>
    </AppShell>
  );
}
