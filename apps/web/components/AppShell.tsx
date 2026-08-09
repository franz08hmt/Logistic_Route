import type { ReactNode } from 'react';

import { Navigation } from './Navigation';
import { FloatingDemoButton } from './demo/FloatingDemoButton';

export function AppShell({
  children,
  fullBleed = false,
}: {
  children: ReactNode;
  fullBleed?: boolean;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <Navigation />
      <main
        className={
          fullBleed
            ? 'min-w-0 pb-20 lg:pl-64 lg:pb-0'
            : 'min-w-0 px-4 pb-24 pt-6 sm:px-6 lg:ml-64 lg:px-8 lg:pb-10 lg:pt-8'
        }
      >
        {children}
      </main>
      <FloatingDemoButton />
    </div>
  );
}
