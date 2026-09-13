'use client';

import { useId, type ReactNode } from 'react';
import {
  AdjustmentsHorizontalIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

/**
 * Console control set.
 *
 * The operations console borrows the reference dashboards' control language:
 * a labelled search field, compact labelled selects, and pill-shaped chips on a
 * charcoal ground. Each control renders a real `<label>`, `<input>`, `<select>`
 * or `<button>` so the browser, assistive technology, and answer engines all
 * read the same structure — no div standing in for a form control.
 */

const FIELD_BASE =
  'w-full rounded-sm border border-slate-200 bg-white text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/25 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500';

export function SearchField({
  label,
  value,
  onChange,
  placeholder,
  hideLabel = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** The magnifier already names the control visually; keep the label for AT. */
  hideLabel?: boolean;
}) {
  const id = useId();

  return (
    <p className="relative w-full">
      <label
        className={hideLabel ? 'sr-only' : 'mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400'}
        htmlFor={id}
      >
        {label}
      </label>
      <input
        id={id}
        type="search"
        className={`${FIELD_BASE} min-h-11 py-2.5 pl-4 pr-11 text-sm`}
        value={value}
        placeholder={placeholder ?? label}
        onChange={(event) => onChange(event.target.value)}
      />
      <MagnifyingGlassIcon
        aria-hidden="true"
        className="pointer-events-none absolute bottom-3 right-3.5 size-5 text-slate-400 dark:text-slate-500"
      />
    </p>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  children,
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  /** Compact renders the reference's small label-above-pill pairing. */
  compact?: boolean;
}) {
  const id = useId();

  return (
    <p className={compact ? 'min-w-0' : 'w-full min-w-0'}>
      <label
        className="mb-1.5 block text-[11px] font-semibold text-slate-500 dark:text-slate-400"
        htmlFor={id}
      >
        {label}
      </label>
      <span className="relative block">
        <select
          id={id}
          className={`${FIELD_BASE} min-h-10 appearance-none py-2 pl-3.5 pr-9 text-sm font-semibold`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {children}
        </select>
        <ChevronDownIcon
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
        />
      </span>
    </p>
  );
}

/** Pill button carrying an icon, used for filters and secondary actions. */
export function PillButton({
  children,
  onClick,
  icon,
  type = 'button',
  disabled = false,
  pressed,
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  type?: 'button' | 'submit';
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      className={`inline-flex min-h-10 items-center gap-2 rounded-sm border px-3.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-50 ${
        pressed
          ? 'border-amber-500 bg-amber-700 dark:bg-amber-400 text-white dark:text-slate-950'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
      }`}
    >
      {icon ?? <AdjustmentsHorizontalIcon aria-hidden="true" className="size-4" />}
      {children}
    </button>
  );
}

/**
 * Read-only metric chip — the icon-plus-value pills along the top of the
 * reference detail card. It carries data, not an action, so it is not a button.
 */
export function MetricChip({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  /** Names the value for assistive technology when the icon alone is ambiguous. */
  label: string;
  value: ReactNode;
}) {
  return (
    <span className="inline-flex min-h-9 items-center gap-2 rounded-sm border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-200">
      <span aria-hidden="true" className="grid size-4 place-items-center text-slate-500 dark:text-slate-400">
        {icon}
      </span>
      <span className="sr-only">{label}: </span>
      {value}
    </span>
  );
}

/**
 * Raised content surface. One radius and one border treatment everywhere keeps
 * the console reading as a single system across pages.
 */
export function Panel({
  children,
  as: Tag = 'section',
  className = '',
  ...rest
}: {
  children: ReactNode;
  as?: 'section' | 'article' | 'aside' | 'div';
  className?: string;
} & Omit<React.HTMLAttributes<HTMLElement>, 'className' | 'children'>) {
  return (
    <Tag
      className={`rounded-sm border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 dark:shadow-none ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
