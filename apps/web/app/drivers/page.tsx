import { AppShell } from '@/components/AppShell';
import { DriversManager } from '@/components/admin/DriversManager';
import { LocalizedPageHeader } from '@/components/LocalizedPageHeader';
import { RoleGuard } from '@/components/RoleGuard';

export default function DriversPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <RoleGuard allowedRoles={['ADMIN', 'DISPATCHER']} redirectTo="/driver">
          <LocalizedPageHeader
            eyebrowKey="drivers.eyebrow"
            titleKey="drivers.title"
            descriptionKey="drivers.description"
          />
          <DriversManager />
        </RoleGuard>
      </div>
    </AppShell>
  );
}
