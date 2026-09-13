import { DepotsManager } from '@/components/admin/DepotsManager';
import { AppShell, ConsoleSection } from '@/components/AppShell';
import { LocalizedPageHeader } from '@/components/LocalizedPageHeader';
import { RoleGuard } from '@/components/RoleGuard';

export default function AdminDepotsPage() {
  return (
    <AppShell>
      <RoleGuard allowedRoles={['ADMIN']} redirectTo="/dashboard">
          <LocalizedPageHeader eyebrowKey="depots.eyebrow" titleKey="depots.title" descriptionKey="depots.description" />
          <ConsoleSection>
          <DepotsManager />
          </ConsoleSection>
        </RoleGuard>
    </AppShell>
  );
}
