// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { I18nProvider } from '@/context/I18nContext';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingServicesTicker } from '@/components/landing/LandingServicesTicker';
import { LandingStorySection } from '@/components/landing/LandingStorySection';

function renderLanding() {
  return render(
    <I18nProvider>
      <div className="landing-portal">
        <LandingHeader />
        <main id="main-content">
          <LandingHero />
          <LandingServicesTicker />
          <LandingStorySection />
        </main>
      </div>
    </I18nProvider>,
  );
}

afterEach(cleanup);

describe('Landing portal', () => {
  it('exposes a single h1 and an ordered heading hierarchy', () => {
    renderLanding();

    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveAttribute('id', 'hero-title');

    // Every section heading is an h2, and every card heading an h3.
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4);
  });

  it('labels its landmarks so the page is navigable without sight', () => {
    renderLanding();

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();

    // Each section is tied to its own heading rather than left anonymous.
    const hero = screen.getByRole('region', { name: /LOGIROUTE VN/i });
    expect(within(hero).getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('gives every icon-only control an accessible name', () => {
    renderLanding();

    for (const control of [
      ...screen.getAllByRole('button'),
      ...screen.getAllByRole('link'),
    ]) {
      expect(control).toHaveAccessibleName();
    }
  });

  it('renders four service cards and the story call to action', () => {
    renderLanding();

    const services = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(services).toEqual(
      expect.arrayContaining(['VẬN TẢI ĐƯỜNG BỘ', 'ĐIỀU PHỐI ĐA HUB', 'COD & VIETQR', 'ECO SCORECARD']),
    );

    // The portal is public and the console is not, so every entry point sends
    // the visitor through sign-in rather than bouncing off a route guard.
    const cta = screen.getByRole('link', { name: /TRẢI NGHIỆM HỆ THỐNG/i });
    expect(cta).toHaveAttribute('href', '/login');
  });

  it('describes both photographs for screen readers', () => {
    renderLanding();

    const images = screen.getAllByRole('img');
    expect(images.length).toBeGreaterThanOrEqual(2);
    for (const image of images) {
      expect(image).toHaveAccessibleName();
    }
  });

  it('keeps the mobile menu collapsed and correctly wired until opened', () => {
    renderLanding();

    const toggle = screen.getByRole('button', { name: /menu/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'landing-mobile-nav');
  });
});
