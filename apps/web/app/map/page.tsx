import { Navigation } from '@/components/Navigation';
import { RouteOptimizationPanel } from '@/components/route-optimization/RouteOptimizationPanel';

export default function MapPage() {
  return (
    <div className="shell">
      <Navigation />
      <main className="content map-content">
        <span className="eyebrow">Dispatch planning</span>
        <h1>Tối ưu tuyến giao hàng</h1>
        <p className="muted page-intro">
          Chuyển đơn đang chờ thành kế hoạch giao hàng cân bằng tải cho toàn bộ đội xe.
        </p>
        <RouteOptimizationPanel />
      </main>
    </div>
  );
}
