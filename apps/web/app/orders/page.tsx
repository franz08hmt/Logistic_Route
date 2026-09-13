import { AppShell, ConsoleSection } from '@/components/AppShell';
import { LocalizedPageHeader } from '@/components/LocalizedPageHeader';
import { OrdersManager } from '@/components/admin/OrdersManager';
import { RoleGuard } from '@/components/RoleGuard';

export default function OrdersPage() {
  return (
    <AppShell>
      <RoleGuard allowedRoles={['ADMIN', 'DISPATCHER']} redirectTo="/driver">
        <LocalizedPageHeader
          eyebrowKey="orders.eyebrow"
          titleKey="orders.title"
          descriptionKey="orders.description"
        />
        <ConsoleSection>
          <OrdersManager />
        </ConsoleSection>
      </RoleGuard>
    </AppShell>
  );
}
