import { AdminUsersManager } from '@/components/admin/AdminUsersManager';
import { AppShell, ConsoleSection } from '@/components/AppShell';
import { LocalizedPageHeader } from '@/components/LocalizedPageHeader';
import { RoleGuard } from '@/components/RoleGuard';

export default function AdminUsersPage() {
  return (
    <AppShell>
      <RoleGuard allowedRoles={['ADMIN', 'DISPATCHER']} redirectTo="/dashboard">
        <LocalizedPageHeader
          eyebrowKey="admin.users.eyebrow"
          titleKey="admin.users.title"
          descriptionKey="admin.users.description"
        />
        <ConsoleSection>
          <AdminUsersManager />
        </ConsoleSection>
      </RoleGuard>
    </AppShell>
  );
}
