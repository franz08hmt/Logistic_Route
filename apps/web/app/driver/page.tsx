import { AppShell, ConsoleSection } from '@/components/AppShell';
import { DriverWorkspace } from '@/components/driver/DriverWorkspace';
import { LocalizedPageHeader } from '@/components/LocalizedPageHeader';
import { RoleGuard } from '@/components/RoleGuard';

export default function DriverPage() {
  return (
    <AppShell>
      <RoleGuard allowedRoles={['DRIVER']} redirectTo="/dashboard">
        <LocalizedPageHeader
          eyebrowKey="driver.eyebrow"
          titleKey="driver.routeTitle"
          descriptionKey="driver.description"
        />
        <ConsoleSection>
          <DriverWorkspace />
        </ConsoleSection>
      </RoleGuard>
    </AppShell>
  );
}
