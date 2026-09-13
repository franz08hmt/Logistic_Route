import { LandingHeader } from '@/components/landing/LandingHeader';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingServicesTicker } from '@/components/landing/LandingServicesTicker';
import { LandingStorySection } from '@/components/landing/LandingStorySection';

export default function HomePage() {
  return (
    <div className="landing-portal relative min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-6 focus:top-6 focus:z-50 focus:rounded-full focus:bg-orange-400 focus:px-5 focus:py-2 focus:text-sm focus:font-bold focus:text-slate-900"
      >
        Bỏ qua điều hướng
      </a>

      <LandingHeader />

      <main id="main-content">
        {/* The service row renders inside the hero's positioned container so it
            lies over the photograph, the way the reference theme floats it. */}
        <LandingHero>
          <LandingServicesTicker />
        </LandingHero>
        <LandingStorySection />
      </main>

      <footer className="border-t border-white/10 bg-cinema-900">
        {/* slate-400, not slate-500: measured 4.18:1 on #08090d, below WCAG AA. */}
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-8 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© {new Date().getFullYear()} LogiRoute VN</p>
          <p>TP. Hồ Chí Minh · Hà Nội · Đà Nẵng · Cần Thơ</p>
        </div>
      </footer>
    </div>
  );
}
