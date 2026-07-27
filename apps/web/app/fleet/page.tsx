import { Navigation } from '@/components/Navigation';
import { FleetManager } from '@/components/admin/FleetManager';

export default function FleetPage() {
  return (
    <div className="shell">
      <Navigation />
      <main className="content management-content">
        <span className="eyebrow">Fleet operations</span>
        <h1>Quản lý đội xe</h1>
        <p className="muted page-intro">
          Quản lý tải trọng, tài xế phụ trách và trạng thái sẵn sàng của phương tiện.
        </p>
        <FleetManager />
      </main>
    </div>
  );
}
