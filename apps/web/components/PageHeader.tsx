import type { ReactNode } from 'react';

import { SectionHeading } from './ui/Section';

/**
 * Screen title, set in the landing portal's Story style: an amber eyebrow, a
 * wide uppercase title, and a short rule. Replacing the old bordered band with
 * the portal's own heading block is what makes a console screen and the public
 * page read as one product.
 */
export function PageHeader({
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
  return (
    <div className="pb-2">
      <SectionHeading as="h1" size="page" subtitle={eyebrow} title={title} action={action} />
      <p className="mt-5 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-base">
        {description}
      </p>
    </div>
  );
}
