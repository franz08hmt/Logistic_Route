import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { I18nProvider } from '@/context/I18nContext';
import { DepotProvider } from '@/context/DepotContext';
import { ThemeProvider } from '@/components/ThemeProvider';

const poppins = Poppins({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
});

const SITE_NAME = 'LogiRoute VN';
const SITE_DESCRIPTION =
  'Nền tảng điều vận, quản lý đội xe và tối ưu lộ trình giao hàng chặng cuối cho thị trường Việt Nam.';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://logiroute.vn';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Nền tảng Tối ưu Lộ trình & Logistics Việt Nam`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'tối ưu lộ trình',
    'điều phối logistics',
    'quản lý đội xe',
    'giao hàng chặng cuối',
    'đối soát COD',
    'VietQR',
    'vehicle routing problem',
    'last mile delivery Vietnam',
  ],
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    alternateLocale: ['en_US'],
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Nền tảng Tối ưu Lộ trình & Logistics Việt Nam`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/landing/hero-freight.webp',
        width: 1920,
        height: 1080,
        alt: 'Xe đầu kéo container chạy trên cao tốc trong ánh hoàng hôn',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — Tối ưu Lộ trình & Logistics`,
    description: SITE_DESCRIPTION,
    images: ['/landing/hero-freight.webp'],
  },
  alternates: {
    canonical: '/',
    languages: { 'vi-VN': '/', 'en-US': '/?lang=en' },
  },
  robots: { index: true, follow: true },
};

/**
 * Structured data for search engines and AI answer engines.
 *
 * Two valid Schema.org types are used rather than the non-existent
 * "LogisticsService": `SoftwareApplication` describes the product, and
 * `Service` with `serviceType` describes what it does for customers.
 */
const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE_URL}/#software`,
      name: `${SITE_NAME} - Nền tảng Tối ưu Lộ trình & Logistics Việt Nam`,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      inLanguage: ['vi-VN', 'en-US'],
      description: SITE_DESCRIPTION,
      featureList: [
        'Vehicle Routing Problem (VRP)',
        'Multi-Depot Hubs',
        'COD Reconciliation',
        'Real-Time Driver Telemetry',
      ],
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'VND' },
    },
    {
      '@type': 'Service',
      '@id': `${SITE_URL}/#service`,
      name: 'Điều vận và tối ưu lộ trình giao hàng chặng cuối',
      serviceType: 'Logistics route optimisation and fleet dispatch',
      areaServed: { '@type': 'Country', name: 'Việt Nam' },
      availableChannel: {
        '@type': 'ServiceChannel',
        serviceUrl: SITE_URL,
        availableLanguage: ['vi-VN', 'en-US'],
      },
      provider: { '@id': `${SITE_URL}/#software` },
    },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={poppins.variable} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          // Serialised once at build time from a constant object, never from user input.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
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
