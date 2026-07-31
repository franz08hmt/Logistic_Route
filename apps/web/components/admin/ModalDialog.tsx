'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useI18n } from '@/context/I18nContext';

type ModalDialogProps = {
  open: boolean;
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
};

export function ModalDialog({
  open,
  eyebrow,
  title,
  description,
  children,
  onClose,
}: ModalDialogProps) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="m-auto max-h-[calc(100vh-2rem)] w-[min(42rem,calc(100%-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div>
        <header className="flex items-start justify-between gap-5 border-b border-slate-200 px-5 py-5 dark:border-slate-800 sm:px-6">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-400">{eyebrow ?? t('common.recordNew')}</span>
            <h2 id={titleId} className="mt-1 text-xl font-semibold tracking-tight">{title}</h2>
            <p id={descriptionId} className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">{description}</p>
          </div>
          <button
            className="grid size-9 shrink-0 place-items-center rounded-lg text-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-teal-600 dark:hover:bg-slate-800 dark:hover:text-white"
            type="button"
            aria-label={t('common.closeDialog')}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
