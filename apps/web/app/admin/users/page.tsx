import { AdminUsersManager } from '@/components/admin/AdminUsersManager';
import { AppShell } from '@/components/AppShell';
import { LocalizedPageHeader } from '@/components/LocalizedPageHeader';
import { RoleGuard } from '@/components/RoleGuard';

export default function AdminUsersPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <RoleGuard allowedRoles={['ADMIN', 'DISPATCHER']} redirectTo="/dashboard">
          <LocalizedPageHeader
            eyebrowKey="admin.users.eyebrow"
            titleKey="admin.users.title"
            descriptionKey="admin.users.description"
          />
          <AdminUsersManager />
        </RoleGuard>
      </div>
    </AppShell>
  );
}
