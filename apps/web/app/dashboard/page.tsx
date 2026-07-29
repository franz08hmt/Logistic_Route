import { DashboardOverview } from '@/components/DashboardOverview';
import { AppShell } from '@/components/AppShell';
import { LocalizedPageHeader } from '@/components/LocalizedPageHeader';
import { RoleGuard } from '@/components/RoleGuard';

export default function DashboardPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <RoleGuard allowedRoles={['ADMIN', 'DISPATCHER']} redirectTo="/driver">
          <LocalizedPageHeader
            eyebrowKey="dashboard.eyebrow"
            titleKey="dashboard.title"
            descriptionKey="dashboard.description"
          />
          <DashboardOverview />
        </RoleGuard>
      </div>
    </AppShell>
  );
}
