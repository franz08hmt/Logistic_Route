import { AppShell, ConsoleSection } from '@/components/AppShell';
import { DriversManager } from '@/components/admin/DriversManager';
import { LocalizedPageHeader } from '@/components/LocalizedPageHeader';
import { RoleGuard } from '@/components/RoleGuard';

export default function DriversPage() {
  return (
    <AppShell>
      <RoleGuard allowedRoles={['ADMIN', 'DISPATCHER']} redirectTo="/driver">
        <LocalizedPageHeader
          eyebrowKey="drivers.eyebrow"
          titleKey="drivers.title"
          descriptionKey="drivers.description"
        />
        <ConsoleSection>
          <DriversManager />
        </ConsoleSection>
      </RoleGuard>
    </AppShell>
  );
}
