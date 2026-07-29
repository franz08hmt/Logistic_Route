import { AppShell } from '@/components/AppShell';
import { DispatchCenter } from '@/components/dispatch/DispatchCenter';
import { LocalizedPageHeader } from '@/components/LocalizedPageHeader';
import { RoleGuard } from '@/components/RoleGuard';

export default function DispatchPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[96rem] space-y-6">
        <RoleGuard allowedRoles={['ADMIN', 'DISPATCHER']} redirectTo="/driver">
          <LocalizedPageHeader
            eyebrowKey="dispatch.eyebrow"
            titleKey="dispatch.title"
            descriptionKey="dispatch.description"
          />
          <DispatchCenter />
        </RoleGuard>
      </div>
    </AppShell>
  );
}
