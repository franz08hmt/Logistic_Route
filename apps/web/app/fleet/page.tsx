import { AppShell } from '@/components/AppShell';
import { LocalizedPageHeader } from '@/components/LocalizedPageHeader';
import { FleetManager } from '@/components/admin/FleetManager';
import { RoleGuard } from '@/components/RoleGuard';

export default function FleetPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <RoleGuard allowedRoles={['ADMIN', 'DISPATCHER']} redirectTo="/driver">
          <LocalizedPageHeader
            eyebrowKey="fleet.eyebrow"
            titleKey="fleet.title"
            descriptionKey="fleet.description"
          />
          <FleetManager />
        </RoleGuard>
      </div>
    </AppShell>
  );
}
