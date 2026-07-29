'use client';

import { useEffect, useRef } from 'react';

import { useI18n } from '@/context/I18nContext';
import { RegionMismatchDialog } from './RegionMismatchDialog';

export function RegionMismatchAlert({
  driverName,
  driverRegion,
  deliveryRegion,
  isSubmitting,
  onCancel,
  onConfirm,
}: {
  driverName: string;
  driverRegion: string;
  deliveryRegion: string;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (!dialog.open) {
      dialog.showModal();
    }
    cancelRef.current?.focus();

    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, []);

  return (
    <RegionMismatchDialog
      ref={dialogRef}
      title={t('orders.regionMismatchTitle')}
      description={t('orders.regionMismatchDescription', {
        name: driverName,
        driverRegion,
        deliveryRegion,
      })}
      cancelLabel={t('orders.chooseAgain')}
      confirmLabel={isSubmitting ? t('orders.creating') : t('orders.confirmMismatch')}
      isSubmitting={isSubmitting}
      cancelButtonRef={cancelRef}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
