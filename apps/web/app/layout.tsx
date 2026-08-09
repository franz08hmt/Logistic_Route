import type { Metadata } from 'next';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { I18nProvider } from '@/context/I18nContext';
import { DepotProvider } from '@/context/DepotContext';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'LogiRoute VN',
  description: 'Route optimization and logistics management platform for Vietnam.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              <DepotProvider>{children}</DepotProvider>
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
