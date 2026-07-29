import { AppShell } from '@/components/AppShell';
import { DriverWorkspace } from '@/components/driver/DriverWorkspace';
import { RoleGuard } from '@/components/RoleGuard';

export default function DriverPage() {
  return (
    <AppShell>
      <RoleGuard allowedRoles={['DRIVER']} redirectTo="/dashboard">
        <DriverWorkspace />
      </RoleGuard>
    </AppShell>
  );
}
