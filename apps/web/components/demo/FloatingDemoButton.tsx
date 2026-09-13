'use client';

import { useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { DemoTourModal } from './DemoTourModal';

export function FloatingDemoButton() {
  const { user, isLoading } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  if (isLoading || !user || user.role === 'DRIVER') {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="fixed bottom-20 right-4 z-[1050] inline-flex min-h-12 items-center gap-2 rounded-full border border-white/30 bg-amber-700 dark:bg-amber-400 px-4 py-3 text-sm font-bold text-white dark:text-slate-950 transition hover:-translate-y-0.5 hover:bg-amber-800 dark:hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:border-amber-400/20 lg:bottom-6 lg:right-6"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="text-lg" aria-hidden="true">🚀</span>
        <span className="hidden sm:inline">{t('demo.floatingAction')}</span>
        <span className="sr-only sm:hidden">{t('demo.floatingAction')}</span>
      </button>
      <DemoTourModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
