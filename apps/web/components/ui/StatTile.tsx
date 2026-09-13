import type { ReactNode } from 'react';

import { HairlineCell, HairlineGrid } from './Section';

/**
 * Statistic tile in the landing portal's vocabulary.
 *
 * The portal separates blocks with hairlines rather than boxes, so a tile is a
 * flat cell inside `StatTileGrid` — no border of its own, no radius, no shadow.
 * Labels are set in the portal's wide uppercase micro-type.
 */
export type StatTileTone = 'neutral' | 'accent' | 'positive' | 'warning' | 'info';

const DOT_CLASSES: Record<StatTileTone, string> = {
  neutral: 'bg-slate-400',
  accent: 'bg-cinema-accent',
  positive: 'bg-emerald-400',
  warning: 'bg-orange-400',
  info: 'bg-sky-400',
};

const VALUE_CLASSES: Record<StatTileTone, string> = {
  neutral: 'text-slate-950 dark:text-white',
  accent: 'text-amber-700 dark:text-cinema-accent',
  positive: 'text-emerald-700 dark:text-emerald-300',
  warning: 'text-orange-800 dark:text-orange-300',
  info: 'text-sky-700 dark:text-sky-300',
};

/** Wraps a row of tiles in the portal's hairline grid. */
export function StatTileGrid({
  children,
  columns = 4,
  label,
}: {
  children: ReactNode;
  columns?: 2 | 3 | 4;
  label?: string;
}) {
  return (
    <section aria-label={label}>
      <HairlineGrid columns={columns}>{children}</HairlineGrid>
    </section>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: StatTileTone;
}) {
  return (
    <HairlineCell>
      <article className="flex h-full flex-col px-6 py-7">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {label}
          </p>
          {icon ? (
            <span
              className="shrink-0 text-slate-400 dark:text-slate-500"
              aria-hidden="true"
            >
              {icon}
            </span>
          ) : (
            <span
              className={`mt-1 size-2 shrink-0 rounded-full ${DOT_CLASSES[tone]}`}
              aria-hidden="true"
            />
          )}
        </div>
        <p
          className={`mt-3 text-3xl font-extrabold tracking-tight tabular-nums ${VALUE_CLASSES[tone]}`}
        >
          {value}
        </p>
        {hint && (
          <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {hint}
          </p>
        )}
      </article>
    </HairlineCell>
  );
}

/** Compact counter strip, on the same hairline ground as the tiles. */
export function StatStrip({
  items,
}: {
  items: ReadonlyArray<{ label: string; value: ReactNode }>;
}) {
  return (
    <HairlineGrid columns={3} as="div">
      {items.map((item) => (
        <HairlineCell as="div" key={item.label}>
          <p className="flex items-center justify-between gap-3 px-6 py-5">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              {item.label}
            </span>
            <span className="text-xl font-extrabold tabular-nums text-slate-950 dark:text-white">
              {item.value}
            </span>
          </p>
        </HairlineCell>
      ))}
    </HairlineGrid>
  );
}

/**
 * Uppercase micro-label carrying the portal's typographic signature. Sits on
 * light surfaces too, so it uses the pitched down accent ink there.
 */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-cinema-accent">
      {children}
    </p>
  );
}
