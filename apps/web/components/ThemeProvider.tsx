'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ReactNode } from 'react';

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    // The console is designed dark first, so it opens dark rather than
    // following the operating system. The toggle still switches to light, which
    // AGENTS.md asks for: drivers work outdoors in direct sunlight.
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableColorScheme
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
