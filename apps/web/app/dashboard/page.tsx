import { DashboardOverview } from '@/components/DashboardOverview';
import { AppShell, ConsoleSection } from '@/components/AppShell';
import { LocalizedPageHeader } from '@/components/LocalizedPageHeader';
import { RoleGuard } from '@/components/RoleGuard';

export default function DashboardPage() {
  return (
    <AppShell>
      <RoleGuard allowedRoles={['ADMIN', 'DISPATCHER']} redirectTo="/driver">
        <LocalizedPageHeader
          eyebrowKey="dashboard.eyebrow"
          titleKey="dashboard.title"
          descriptionKey="dashboard.description"
        />
        <ConsoleSection>
          <DashboardOverview />
        </ConsoleSection>
      </RoleGuard>
    </AppShell>
  );
}
