import { Navigation } from '@/components/Navigation';
import { OrdersManager } from '@/components/admin/OrdersManager';
import { RoleGuard } from '@/components/RoleGuard';

export default function OrdersPage() {
  return (
    <div className="shell">
      <Navigation />
      <main className="content management-content">
        <RoleGuard allowedRoles={['ADMIN', 'DISPATCHER']} redirectTo="/driver">
        <span className="eyebrow">Order operations</span>
        <h1>Quản lý đơn hàng</h1>
        <p className="muted page-intro">
          Theo dõi điểm giao, khối lượng và trạng thái phân công của toàn bộ đơn hàng.
        </p>
        <OrdersManager />
        </RoleGuard>
      </main>
    </div>
  );
}
