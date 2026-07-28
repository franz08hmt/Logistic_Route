import { DashboardOverview } from '@/components/DashboardOverview';
import { Navigation } from '@/components/Navigation';
import { RoleGuard } from '@/components/RoleGuard';

export default function DashboardPage() {
  return (
    <div className="shell">
      <Navigation />
      <main className="content">
        <RoleGuard allowedRoles={['ADMIN', 'DISPATCHER']} redirectTo="/driver">
          <span className="eyebrow">Dashboard</span>
          <h1>Operations overview</h1>
          <p className="muted">Live KPIs from the LogiRoute VN API.</p>
          <DashboardOverview />
        </RoleGuard>
      </main>
    </div>
  );
}
