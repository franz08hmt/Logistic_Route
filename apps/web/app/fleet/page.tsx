import { AppShell, ConsoleSection } from '@/components/AppShell';
import { LocalizedPageHeader } from '@/components/LocalizedPageHeader';
import { FleetManager } from '@/components/admin/FleetManager';
import { RoleGuard } from '@/components/RoleGuard';

export default function FleetPage() {
  return (
    <AppShell>
      <RoleGuard allowedRoles={['ADMIN', 'DISPATCHER']} redirectTo="/driver">
        <LocalizedPageHeader
          eyebrowKey="fleet.eyebrow"
          titleKey="fleet.title"
          descriptionKey="fleet.description"
        />
        <ConsoleSection>
          <FleetManager />
        </ConsoleSection>
      </RoleGuard>
    </AppShell>
  );
}
