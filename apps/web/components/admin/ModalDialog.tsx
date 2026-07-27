'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

type ModalDialogProps = {
  open: boolean;
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
};

export function ModalDialog({
  open,
  title,
  description,
  children,
  onClose,
}: ModalDialogProps) {
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
      className="management-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="dialog-surface">
        <header className="dialog-header">
          <div>
            <span className="eyebrow">New record</span>
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId}>{description}</p>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Đóng hộp thoại"
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
