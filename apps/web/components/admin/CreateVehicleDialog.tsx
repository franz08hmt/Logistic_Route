'use client';

import { useState, type FormEvent } from 'react';
import { useI18n } from '@/context/I18nContext';

import type { CreateVehicleInput } from './api-contracts';
import {
  fieldInputClass,
  fieldLabelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from './form-styles';
import { ModalDialog } from './ModalDialog';

type CreateVehicleDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (input: CreateVehicleInput) => Promise<void>;
};

export function CreateVehicleDialog({ open, onClose, onCreate }: CreateVehicleDialogProps) {
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    const driverName = String(data.get('driver_name') ?? '').trim();
    const input: CreateVehicleInput = {
      license_plate: String(data.get('license_plate') ?? '').trim().toUpperCase(),
      capacity_kg: Number(data.get('capacity_kg')),
      vehicle_type: String(data.get('vehicle_type') ?? 'TRUCK').trim() || 'TRUCK',
      driver_name: driverName || null,
    };

    try {
      await onCreate(input);
      form.reset();
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : t('fleet.addError'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalDialog
      open={open}
      title={t('fleet.dialogTitle')}
      description={t('fleet.dialogDescription')}
      onClose={onClose}
    >
      <form className="px-5 py-5 sm:px-6" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={fieldLabelClass}>
            <span>{t('fleet.licensePlate')}</span>
            <input className={fieldInputClass} name="license_plate" placeholder="51D-12345" minLength={2} maxLength={30} required autoFocus />
          </label>
          <label className={fieldLabelClass}>
            <span>{t('fleet.maxCapacity')} (kg)</span>
            <input className={fieldInputClass} name="capacity_kg" type="number" placeholder="750" min="0.1" step="0.1" required />
          </label>
          <label className={`${fieldLabelClass} sm:col-span-2`}>
            <span>{t('fleet.vehicleType')}</span>
            <input className={fieldInputClass} name="vehicle_type" placeholder={t('fleet.vehicleTypePlaceholder')} defaultValue="TRUCK" maxLength={50} required />
          </label>
          <label className={`${fieldLabelClass} sm:col-span-2`}>
            <span>{t('fleet.driverName')} <small className="font-normal text-slate-500 dark:text-slate-400">({t('common.optional')})</small></span>
            <input className={fieldInputClass} name="driver_name" placeholder={t('fleet.driverPlaceholder')} maxLength={150} />
          </label>
        </div>

        {error && (
          <p className="mt-4 rounded-sm border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300" role="alert">
            {error}
          </p>
        )}
        <footer className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 dark:border-slate-800 sm:flex-row sm:justify-end">
          <button className={secondaryButtonClass} type="button" onClick={onClose}>{t('common.cancel')}</button>
          <button className={primaryButtonClass} type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('fleet.adding') : t('fleet.addAction')}
          </button>
        </footer>
      </form>
    </ModalDialog>
  );
}
