import { AppShell, ConsoleSection } from '@/components/AppShell';
import { DispatchCenter } from '@/components/dispatch/DispatchCenter';
import { LocalizedPageHeader } from '@/components/LocalizedPageHeader';
import { RoleGuard } from '@/components/RoleGuard';

export default function DispatchPage() {
  return (
    <AppShell>
      <RoleGuard allowedRoles={['ADMIN', 'DISPATCHER']} redirectTo="/driver">
        <LocalizedPageHeader
          eyebrowKey="dispatch.eyebrow"
          titleKey="dispatch.title"
          descriptionKey="dispatch.description"
        />
        <ConsoleSection>
          <DispatchCenter />
        </ConsoleSection>
      </RoleGuard>
    </AppShell>
  );
}
