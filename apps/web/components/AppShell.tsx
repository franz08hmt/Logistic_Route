import type { ReactNode } from 'react';

import { ConsoleHeader } from './console/ConsoleHeader';
import { FloatingDemoButton } from './demo/FloatingDemoButton';

/**
 * Console frame.
 *
 * Navigation runs across the top rather than down the side, matching the public
 * portal, and `main` is full bleed so a page banner can reach both edges. Pages
 * constrain their own body content; the shell no longer imposes a gutter.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <a
        href="#console-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-6 focus:top-6 focus:z-[1100] focus:rounded-sm focus:bg-cinema-accent focus:px-5 focus:py-2 focus:text-sm focus:font-bold focus:text-cinema-900"
      >
        Bỏ qua điều hướng
      </a>

      <ConsoleHeader />
      <main id="console-content" className="min-w-0">
        {children}
      </main>
      <FloatingDemoButton />
    </div>
  );
}

/**
 * Body container for a console screen, sitting under the full-bleed banner.
 * One place decides the gutter and the rhythm between blocks.
 */
export function ConsoleSection({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[100rem] space-y-8 px-6 py-10 sm:px-8 lg:py-12">
      {children}
    </div>
  );
}
