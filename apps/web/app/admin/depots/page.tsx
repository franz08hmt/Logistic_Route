import { DepotsManager } from '@/components/admin/DepotsManager';
import { AppShell } from '@/components/AppShell';
import { LocalizedPageHeader } from '@/components/LocalizedPageHeader';
import { RoleGuard } from '@/components/RoleGuard';

export default function AdminDepotsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <RoleGuard allowedRoles={['ADMIN']} redirectTo="/dashboard">
          <LocalizedPageHeader eyebrowKey="depots.eyebrow" titleKey="depots.title" descriptionKey="depots.description" />
          <DepotsManager />
        </RoleGuard>
      </div>
    </AppShell>
  );
}
