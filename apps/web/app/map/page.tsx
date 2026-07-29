import { AppShell } from '@/components/AppShell';
import { RoleGuard } from '@/components/RoleGuard';
import { RouteOptimizationPanel } from '@/components/route-optimization/RouteOptimizationPanel';

export default function MapPage() {
  return (
    <AppShell fullBleed>
      <RoleGuard allowedRoles={['ADMIN', 'DISPATCHER']} redirectTo="/driver">
        <RouteOptimizationPanel />
      </RoleGuard>
    </AppShell>
  );
}
