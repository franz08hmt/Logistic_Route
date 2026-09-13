'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Cinematic opener for a console screen.
 *
 * The console now begins the way the public portal does: a photograph under a
 * vignette, an amber eyebrow, an oversized uppercase title and a short rule.
 * It is shorter than the portal's hero because an operator needs the data in
 * view, but it is the same device rather than a different one.
 *
 * Two photographs ship with the project, so screens are grouped by subject
 * rather than given one image each. Dropping more files into `public/console/`
 * and extending `BANNERS` is all it takes to separate them further.
 */

type Banner = {
  src: string;
  alt: string;
  position: string;
  /** Exposure lift sized to the photograph's own luminance, so a dark
   *  image and a bright one reach the vignette at a comparable level. */
  exposure: string;
};

const FREIGHT: Banner = {
  src: '/landing/hero-freight.webp',
  alt: 'Xe đầu kéo container chạy trên cao tốc trong ánh hoàng hôn',
  position: 'object-[center_62%]',
  // Measured 0.354 across the band; it needs no help.
  exposure: '',
};

const INTERCHANGE: Banner = {
  src: '/landing/story-interchange.webp',
  alt: 'Nút giao thông nhiều tầng nhìn từ trên cao',
  position: 'object-[center_38%]',
  // Measured 0.117, roughly a third of the freight photograph. Brightness is
  // gamma-weighted, so ~1.5 closes a 3x luminance gap without clipping the
  // highlights; a little contrast keeps the roads from going muddy.
  exposure: 'brightness-[1.5] contrast-[1.08] saturate-[0.95]',
};

/** Operations screens ride with the freight photograph; planning and finance
 *  screens take the interchange, which reads as network rather than vehicle. */
const BANNERS: Record<string, Banner> = {
  '/dashboard': INTERCHANGE,
  '/orders': FREIGHT,
  '/dispatch': INTERCHANGE,
  '/fleet': FREIGHT,
  '/drivers': FREIGHT,
  '/driver': FREIGHT,
  '/analytics': INTERCHANGE,
  '/admin/cod': INTERCHANGE,
  '/admin/users': INTERCHANGE,
  '/admin/depots': FREIGHT,
  '/admin/system': INTERCHANGE,
};

export function PageBanner({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const pathname = usePathname();
  const banner = BANNERS[pathname] ?? FREIGHT;

  return (
    <section aria-labelledby="page-title" className="relative isolate overflow-hidden">
      <Image
        src={banner.src}
        alt={banner.alt}
        fill
        priority
        sizes="100vw"
        className={`-z-10 object-cover ${banner.position} ${banner.exposure}`}
      />
      {/* Resolves the photograph into the page ground, the way the portal hero
          does, so the banner and the content below read as one surface. */}
      <div className="console-banner-scrim absolute inset-0 -z-10" aria-hidden="true" />

      <div className="mx-auto flex max-w-[100rem] flex-col gap-6 px-6 pb-10 pt-14 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:pb-12 lg:pt-20">
        <div className="max-w-3xl">
          {/* On its own the 11px amber measured 2.5-3.2:1 over the photograph.
              A scrim heavy enough to fix that would hide the photograph, so the
              label carries its own ground instead: 10.69:1, unconditionally. */}
          <p>
            <span className="inline-block bg-cinema-accent px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-cinema-900 sm:text-[11px]">
              {eyebrow}
            </span>
          </p>
          <h1
            id="page-title"
            className="mt-4 text-balance text-3xl font-extrabold uppercase leading-[1.05] tracking-wider text-white sm:text-4xl lg:text-5xl"
          >
            {title}
          </h1>
          <hr className="mt-6 w-24 border-t border-white/25" />
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
            {description}
          </p>
        </div>
        {action}
      </div>
    </section>
  );
}
