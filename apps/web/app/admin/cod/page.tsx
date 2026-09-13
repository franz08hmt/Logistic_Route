import { AppShell, ConsoleSection } from '@/components/AppShell';
import { CodReconciliationCenter } from '@/components/cod/CodReconciliationCenter';
import { LocalizedPageHeader } from '@/components/LocalizedPageHeader';
import { RoleGuard } from '@/components/RoleGuard';

export default function AdminCodPage() {
  return (
    <AppShell>
      <RoleGuard allowedRoles={['ADMIN', 'DISPATCHER']} redirectTo="/dashboard">
        <LocalizedPageHeader
          eyebrowKey="cod.eyebrow"
          titleKey="cod.title"
          descriptionKey="cod.description"
        />
        <ConsoleSection>
          <CodReconciliationCenter />
        </ConsoleSection>
      </RoleGuard>
    </AppShell>
  );
}
