'use client';

import {
  forwardRef,
  type Ref,
} from 'react';

import { primaryButtonClass, secondaryButtonClass } from './form-styles';

export const RegionMismatchDialog = forwardRef<
  HTMLDialogElement,
  {
    title: string;
    description: string;
    cancelLabel: string;
    confirmLabel: string;
    isSubmitting: boolean;
    cancelButtonRef?: Ref<HTMLButtonElement>;
    onCancel: () => void;
    onConfirm: () => void;
  }
>(function RegionMismatchDialog(
  {
    title,
    description,
    cancelLabel,
    confirmLabel,
    isSubmitting,
    cancelButtonRef,
    onCancel,
    onConfirm,
  },
  dialogRef,
) {
  return (
    <dialog
      ref={dialogRef}
      className="m-auto w-[min(28rem,calc(100%-2rem))] overflow-visible rounded-2xl border-0 bg-transparent p-0 backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm"
      aria-modal="true"
      aria-labelledby="region-mismatch-title"
      aria-describedby="region-mismatch-description"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <section className="w-full rounded-2xl border border-amber-200 bg-white p-5 text-slate-950 shadow-2xl dark:border-amber-900 dark:bg-slate-900 dark:text-white">
        <span className="grid size-11 place-items-center rounded-full bg-amber-100 text-xl text-amber-800 dark:bg-amber-950 dark:text-amber-300" aria-hidden="true">!</span>
        <h3 id="region-mismatch-title" className="mt-4 text-lg font-bold">{title}</h3>
        <p id="region-mismatch-description" className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {description}
        </p>
        <footer className="mt-6 grid grid-cols-2 gap-2">
          <button
            ref={cancelButtonRef}
            className={secondaryButtonClass}
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {cancelLabel}
          </button>
          <button
            className={primaryButtonClass}
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {confirmLabel}
          </button>
        </footer>
      </section>
    </dialog>
  );
});
