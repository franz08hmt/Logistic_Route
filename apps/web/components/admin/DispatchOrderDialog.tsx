'use client';

import { useEffect, useState, type FormEvent } from 'react';

import { useI18n } from '@/context/I18nContext';
import type {
  AvailableDriver,
  DispatchOrderInput,
  Order,
} from './api-contracts';
import {
  fieldInputClass,
  fieldLabelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from './form-styles';
import { ModalDialog } from './ModalDialog';
import { getRegionMismatch } from './region-match';
import { RegionMismatchAlert } from './RegionMismatchAlert';

type PendingDispatch = {
  input: DispatchOrderInput;
  driver: AvailableDriver;
};

export function DispatchOrderDialog({
  order,
  availableDrivers,
  isSubmitting,
  onClose,
  onDispatch,
}: {
  order: Order | null;
  availableDrivers: AvailableDriver[];
  isSubmitting: boolean;
  onClose: () => void;
  onDispatch: (orderId: string, input: DispatchOrderInput) => Promise<void>;
}) {
  const { t } = useI18n();
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [pendingDispatch, setPendingDispatch] = useState<PendingDispatch | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedDriverId('');
    setPendingDispatch(null);
    setError(null);
  }, [order?.id]);

  async function submit(input: DispatchOrderInput) {
    if (!order) {
      return;
    }
    setError(null);
    try {
      await onDispatch(order.id, input);
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t('orders.dispatchError'),
      );
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!order || !selectedDriverId) {
      setError(t('orders.selectDriverRequired'));
      return;
    }

    const driver = availableDrivers.find(
      (item) => item.driver_id === selectedDriverId,
    );
    if (!driver) {
      setError(t('orders.driverNoLongerAvailable'));
      return;
    }

    const input: DispatchOrderInput = { driver_id: driver.driver_id };
    const mismatch = getRegionMismatch(
      order.delivery_region ?? '',
      driver.service_area,
    );
    if (mismatch) {
      setPendingDispatch({ input, driver });
      return;
    }
    void submit(input);
  }

  return (
    <>
      <ModalDialog
        open={order !== null}
        title={t('orders.dispatchTitle', { code: order?.order_code ?? '' })}
        description={t('orders.dispatchDescription')}
        onClose={onClose}
      >
        <form className="space-y-4 px-5 py-5 sm:px-6" onSubmit={handleSubmit}>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-950/60">
            <strong className="block text-slate-950 dark:text-white">
              {order?.customer_name}
            </strong>
            <span className="mt-1 block text-slate-600 dark:text-slate-300">
              {order?.address}
            </span>
            <span className="mt-1 block text-xs text-slate-500">
              {order?.weight_kg} kg
              {order?.delivery_region ? ` · ${order.delivery_region}` : ''}
            </span>
          </div>

          <label className={fieldLabelClass}>
            <span>{t('orders.assignDriver')}</span>
            <select
              className={fieldInputClass}
              value={selectedDriverId}
              onChange={(event) => setSelectedDriverId(event.target.value)}
              required
              autoFocus
            >
              <option value="">{t('orders.selectDriver')}</option>
              {availableDrivers.map((driver) => (
                <option key={driver.driver_id} value={driver.driver_id}>
                  {driver.full_name} · {driver.license_plate} ·{' '}
                  {driver.service_area ?? t('orders.noRegion')}
                </option>
              ))}
            </select>
          </label>

          <p className="text-xs text-slate-500">
            {t('orders.readyDriverHint', { count: availableDrivers.length })}
          </p>
          {error && (
            <p
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300"
              role="alert"
            >
              {error}
            </p>
          )}

          <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 dark:border-slate-800 sm:flex-row sm:justify-end">
            <button
              className={secondaryButtonClass}
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t('common.cancel')}
            </button>
            <button
              className={primaryButtonClass}
              type="submit"
              disabled={isSubmitting || availableDrivers.length === 0}
            >
              {isSubmitting
                ? t('orders.dispatching')
                : t('orders.dispatchAction')}
            </button>
          </footer>
        </form>
      </ModalDialog>

      {pendingDispatch && order && (
        <RegionMismatchAlert
          driverName={pendingDispatch.driver.full_name}
          driverRegion={
            pendingDispatch.driver.service_area ?? t('orders.noRegion')
          }
          deliveryRegion={order.delivery_region ?? t('orders.noRegion')}
          isSubmitting={isSubmitting}
          onCancel={() => setPendingDispatch(null)}
          onConfirm={() =>
            void submit({
              ...pendingDispatch.input,
              force_region_mismatch: true,
            })
          }
        />
      )}
    </>
  );
}
