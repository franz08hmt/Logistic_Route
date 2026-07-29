'use client';

import { useState, type FormEvent } from 'react';

import { useI18n } from '@/context/I18nContext';
import type {
  AvailableDriver,
  CreateOrderInput,
} from './api-contracts';
import {
  fieldInputClass,
  fieldLabelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from './form-styles';
import {
  OrderLocationPicker,
  type OrderLocation,
} from './OrderLocationPicker';
import { getRegionMismatch } from './region-match';
import { RegionMismatchAlert } from './RegionMismatchAlert';
import { ModalDialog } from './ModalDialog';

const initialLocation: OrderLocation = {
  address: '',
  latitude: 10.7769,
  longitude: 106.7009,
  region: '',
};

type PendingMismatch = {
  input: CreateOrderInput;
  driver: AvailableDriver;
};

export function CreateOrderDialog({
  open,
  availableDrivers,
  onClose,
  onCreate,
}: {
  open: boolean;
  availableDrivers: AvailableDriver[];
  onClose: () => void;
  onCreate: (input: CreateOrderInput) => Promise<void>;
}) {
  const { locale, t } = useI18n();
  const [location, setLocation] = useState(initialLocation);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [pendingMismatch, setPendingMismatch] = useState<PendingMismatch | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(input: CreateOrderInput) {
    setIsSubmitting(true);
    setError(null);
    try {
      await onCreate(input);
      setLocation(initialLocation);
      setSelectedDriverId('');
      setPendingMismatch(null);
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('orders.createError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input: CreateOrderInput = {
      order_code: String(data.get('order_code') ?? '').trim(),
      customer_name: String(data.get('customer_name') ?? '').trim(),
      customer_phone: String(data.get('customer_phone') ?? '').trim() || null,
      address: location.address.trim(),
      latitude: location.latitude,
      longitude: location.longitude,
      weight_kg: Number(data.get('weight_kg')),
      delivery_region: location.region.trim() || null,
      assigned_driver_id: selectedDriverId || null,
    };
    const driver = availableDrivers.find((item) => item.driver_id === selectedDriverId);
    const mismatch = driver
      ? getRegionMismatch(location.region, driver.service_area)
      : null;

    // Stop before the API request when the selected driver's registered zone
    // differs from the geocoded delivery region. Confirmation sets the
    // explicit force flag; the backend repeats the same check for security.
    if (driver && mismatch) {
      setPendingMismatch({ input, driver });
      return;
    }
    void create(input);
  }

  return (
    <>
      <ModalDialog open={open} title={t('orders.dialogTitle')} description={t('orders.dialogDescription')} onClose={onClose}>
        <form className="max-h-[calc(100vh-12rem)] overflow-y-auto px-5 py-5 sm:px-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={fieldLabelClass}>
              <span>{t('orders.code')}</span>
              <input className={fieldInputClass} name="order_code" placeholder="LR-HCM-006" minLength={2} maxLength={50} required autoFocus />
            </label>
            <label className={fieldLabelClass}>
              <span>{t('orders.customerName')}</span>
              <input className={fieldInputClass} name="customer_name" placeholder={t('orders.customerPlaceholder')} maxLength={150} required />
            </label>
            <label className={`${fieldLabelClass} sm:col-span-2`}>
              <span>{t('orders.customerPhone')}</span>
              <input className={fieldInputClass} name="customer_phone" type="tel" placeholder="0901 234 567" maxLength={30} />
            </label>

            <OrderLocationPicker value={location} onChange={setLocation} />

            <label className={fieldLabelClass}>
              <span>{t('orders.weight')} (kg)</span>
              <input className={fieldInputClass} name="weight_kg" type="number" placeholder="25" min="0.1" step="0.1" required />
            </label>
            <label className={fieldLabelClass}>
              <span>{t('orders.assignDriver')}</span>
              <select className={fieldInputClass} value={selectedDriverId} onChange={(event) => setSelectedDriverId(event.target.value)}>
                <option value="">{t('orders.leaveUnassigned')}</option>
                {availableDrivers.map((driver) => (
                  <option key={driver.driver_id} value={driver.driver_id}>
                    {driver.full_name} · {driver.license_plate} · {driver.service_area ?? t('orders.noRegion')}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedDriverId && (
            <p className="mt-3 text-xs text-slate-500">
              {t('orders.readyDriverHint', {
                count: availableDrivers.length,
                locale: locale.toUpperCase(),
              })}
            </p>
          )}
          {error && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300" role="alert">{error}</p>}
          <footer className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 dark:border-slate-800 sm:flex-row sm:justify-end">
            <button className={secondaryButtonClass} type="button" onClick={onClose}>{t('common.cancel')}</button>
            <button className={primaryButtonClass} type="submit" disabled={isSubmitting || !location.address.trim()}>
              {isSubmitting ? t('orders.creating') : t('orders.createAction')}
            </button>
          </footer>
        </form>
      </ModalDialog>

      {pendingMismatch && (
        <RegionMismatchAlert
          driverName={pendingMismatch.driver.full_name}
          driverRegion={pendingMismatch.driver.service_area ?? t('orders.noRegion')}
          deliveryRegion={pendingMismatch.input.delivery_region ?? t('orders.noRegion')}
          isSubmitting={isSubmitting}
          onCancel={() => setPendingMismatch(null)}
          onConfirm={() => void create({
            ...pendingMismatch.input,
            force_region_mismatch: true,
          })}
        />
      )}
    </>
  );
}
