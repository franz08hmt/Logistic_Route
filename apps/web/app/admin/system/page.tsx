import { SystemHealthDashboard } from '@/components/admin/SystemHealthDashboard';
import { AppShell } from '@/components/AppShell';
import { LocalizedPageHeader } from '@/components/LocalizedPageHeader';
import { RoleGuard } from '@/components/RoleGuard';

export default function AdminSystemPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <RoleGuard allowedRoles={['ADMIN']} redirectTo="/dashboard">
          <LocalizedPageHeader
            eyebrowKey="system.eyebrow"
            titleKey="system.title"
            descriptionKey="system.description"
          />
          <SystemHealthDashboard />
        </RoleGuard>
      </div>
    </AppShell>
  );
}
