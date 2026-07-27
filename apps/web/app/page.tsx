import { DashboardOverview } from '@/components/DashboardOverview';
import { Navigation } from '@/components/Navigation';

export default function HomePage() {
  return (
    <div className="shell">
      <Navigation />
      <main className="content">
        <span className="eyebrow">Operations workspace</span>
        <h1>Logistics, made predictable.</h1>
        <p className="muted">Live operations overview for orders, fleet, drivers, and route planning.</p>
        <DashboardOverview />
        <a className="route-link" href="/dashboard">Open dashboard</a>
      </main>
    </div>
  );
}
