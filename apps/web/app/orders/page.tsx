import { AppShell } from '@/components/AppShell';
import { LocalizedPageHeader } from '@/components/LocalizedPageHeader';
import { OrdersManager } from '@/components/admin/OrdersManager';
import { RoleGuard } from '@/components/RoleGuard';

export default function OrdersPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <RoleGuard allowedRoles={['ADMIN', 'DISPATCHER']} redirectTo="/driver">
          <LocalizedPageHeader
            eyebrowKey="orders.eyebrow"
            titleKey="orders.title"
            descriptionKey="orders.description"
          />
          <OrdersManager />
        </RoleGuard>
      </div>
    </AppShell>
  );
}
