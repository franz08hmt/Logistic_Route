import { Navigation } from '@/components/Navigation';
import { RoleGuard } from '@/components/RoleGuard';
import { DriverWorkspace } from '@/components/driver/DriverWorkspace';

export default function DriverPage() {
  return (
    <div className="shell driver-shell">
      <Navigation />
      <main className="content driver-content">
        <RoleGuard allowedRoles={['DRIVER']} redirectTo="/dashboard">
          <DriverWorkspace />
        </RoleGuard>
      </main>
    </div>
  );
}
