import { DashboardOverview } from '@/components/DashboardOverview';
import { Navigation } from '@/components/Navigation';

export default function DashboardPage() {
  return (
    <div className="shell">
      <Navigation />
      <main className="content">
        <span className="eyebrow">Dashboard</span>
        <h1>Operations overview</h1>
        <p className="muted">Live KPIs from the LogiRoute VN API.</p>
        <DashboardOverview />
      </main>
    </div>
  );
}
