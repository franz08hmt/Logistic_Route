import type { Metadata } from 'next';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

export const metadata: Metadata = {
  title: 'LogiRoute VN',
  description: 'Route optimization and logistics management platform for Vietnam.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
