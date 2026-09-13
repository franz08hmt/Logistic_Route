import type { ElementType, ReactNode } from 'react';

/**
 * The landing portal's layout language, packaged for the console.
 *
 * The portal separates content with hairlines rather than boxes: a one pixel
 * grid gap over a `white/10` ground, square corners, no shadow, and headings set
 * in wide uppercase. These primitives carry that vocabulary so an operations
 * screen and the public page read as one product.
 *
 * The portal commits to dark; the console keeps its light/dark toggle, so every
 * value here is declared for both grounds.
 */

/** Hairline colour, and the ground a hairline child sits on. */
export const HAIRLINE = 'bg-slate-200 dark:bg-white/10';
export const HAIRLINE_BORDER = 'border-slate-200 dark:border-white/10';
export const SURFACE = 'bg-white dark:bg-cinema-900';

/**
 * Section heading in the portal's Story style: wide uppercase title, an amber
 * sub-label, and a short rule beneath. `as` keeps the document outline correct
 * wherever the block is nested.
 */
export function SectionHeading({
  title,
  subtitle,
  id,
  as: Tag = 'h2',
  action,
  size = 'default',
}: {
  title: string;
  subtitle?: string;
  id?: string;
  as?: ElementType;
  action?: ReactNode;
  /** `page` is the screen title; `default` names a block inside it. */
  size?: 'page' | 'default';
}) {
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        {subtitle && (
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400/90 sm:text-xs">
            {subtitle}
          </p>
        )}
        <Tag
          id={id}
          className={`mt-2 font-bold uppercase tracking-wider text-slate-950 dark:text-white ${
            size === 'page' ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'
          }`}
        >
          {title}
        </Tag>
        <hr className={`mt-5 w-24 border-t ${HAIRLINE_BORDER} dark:border-white/25`} />
      </div>
      {action}
    </header>
  );
}

/**
 * Row of blocks divided by hairlines instead of borders.
 *
 * The one pixel gap over a hairline ground is the portal's own trick: each child
 * paints the page ground, so the gaps read as rules with no border on any card.
 */
export function HairlineGrid({
  children,
  columns = 4,
  as: Tag = 'ul',
}: {
  children: ReactNode;
  columns?: 2 | 3 | 4;
  as?: 'ul' | 'div';
}) {
  const columnClass = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 xl:grid-cols-4',
  }[columns];

  return (
    <Tag
      className={`grid grid-cols-1 gap-px border-y ${HAIRLINE_BORDER} ${HAIRLINE} ${columnClass}`}
    >
      {children}
    </Tag>
  );
}

/** A cell inside `HairlineGrid`; it repaints the ground so the gap shows through. */
export function HairlineCell({
  children,
  as: Tag = 'li',
  interactive = false,
}: {
  children: ReactNode;
  as?: 'li' | 'div';
  interactive?: boolean;
}) {
  return (
    <Tag
      className={`${SURFACE} ${
        interactive ? 'transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.04]' : ''
      }`}
    >
      {children}
    </Tag>
  );
}

/**
 * Data surface. Tables and forms keep a thin frame because a hairline alone
 * stops guiding the eye once rows get dense, but the frame is square and
 * shadowless so it still belongs to the portal's vocabulary.
 */
export function DataFrame({
  children,
  as: Tag = 'div',
  className = '',
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
}) {
  return (
    <Tag
      className={`overflow-hidden rounded-sm border ${HAIRLINE_BORDER} ${SURFACE} ${className}`}
    >
      {children}
    </Tag>
  );
}

/** Ghost action in the portal's CTA style: square, hairline, inverts on hover. */
export function GhostAction({
  children,
  onClick,
  type = 'button',
  disabled = false,
  icon,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="group inline-flex min-h-11 items-center gap-3 rounded-sm border border-slate-300 px-6 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-800 transition-colors hover:bg-slate-950 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/30 dark:text-white dark:hover:bg-white dark:hover:text-slate-900 dark:focus-visible:outline-amber-400"
    >
      {children}
      {icon}
    </button>
  );
}

/** Solid amber action, matching the portal header's dashboard button. */
export function PrimaryAction({
  children,
  onClick,
  type = 'button',
  disabled = false,
  icon,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-11 items-center gap-2.5 rounded-sm bg-amber-700 px-6 text-[11px] font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-amber-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-amber-400 dark:text-slate-900 dark:hover:bg-amber-300 dark:focus-visible:outline-amber-400 dark:disabled:bg-slate-700"
    >
      {icon}
      {children}
    </button>
  );
}

/** Card title in the portal's service-card style. */
export function BlockTitle({
  children,
  as: Tag = 'h3',
  id,
}: {
  children: ReactNode;
  as?: ElementType;
  id?: string;
}) {
  return (
    <Tag
      id={id}
      className="text-sm font-bold uppercase tracking-[0.14em] text-slate-950 dark:text-white"
    >
      {children}
    </Tag>
  );
}
