import { SystemHealthDashboard } from '@/components/admin/SystemHealthDashboard';
import { AppShell, ConsoleSection } from '@/components/AppShell';
import { LocalizedPageHeader } from '@/components/LocalizedPageHeader';
import { RoleGuard } from '@/components/RoleGuard';

export default function AdminSystemPage() {
  return (
    <AppShell>
      <RoleGuard allowedRoles={['ADMIN']} redirectTo="/dashboard">
        <LocalizedPageHeader
          eyebrowKey="system.eyebrow"
          titleKey="system.title"
          descriptionKey="system.description"
        />
        <ConsoleSection>
          <SystemHealthDashboard />
        </ConsoleSection>
      </RoleGuard>
    </AppShell>
  );
}
