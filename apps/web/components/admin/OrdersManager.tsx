'use client';

import { useCallback, useEffect, useState } from 'react';

import { useI18n } from '@/context/I18nContext';
import {
  isAvailableDriverList,
  isOrderList,
  isVehicleList,
  requestApi,
  type AvailableDriver,
  type CreateOrderInput,
  type DispatchOrderInput,
  type Order,
  type Vehicle,
} from './api-contracts';
import { CreateOrderDialog } from './CreateOrderDialog';
import { CsvImportDialog } from './CsvImportDialog';
import { DispatchOrderDialog } from './DispatchOrderDialog';
import { OrderList } from './OrderList';
import { OrderDetailDrawer } from './OrderDetailDrawer';
import {
  publishDataInvalidated,
  publishOrdersUpdated,
  subscribeToDataInvalidated,
  subscribeToOrdersUpdated,
} from './orders-sync';

export function OrdersManager() {
  const { t } = useI18n();
  const [orders, setOrders] = useState<Order[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<AvailableDriver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [dispatchOrder, setDispatchOrder] = useState<Order | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [ordersPayload, driversPayload, vehiclesPayload] = await Promise.all([
        requestApi('/api/v1/orders'),
        requestApi('/api/v1/admin/drivers/available'),
        requestApi('/api/v1/vehicles'),
      ]);
      if (
        !isOrderList(ordersPayload)
        || !isAvailableDriverList(driversPayload)
        || !isVehicleList(vehiclesPayload)
      ) {
        throw new Error(t('orders.invalidList'));
      }
      setOrders(ordersPayload);
      setAvailableDrivers(driversPayload);
      setVehicles(vehiclesPayload);
      setSelectedOrder((current) => (
        current
          ? ordersPayload.find((order) => order.id === current.id) ?? null
          : null
      ));
      setError(null);
      return ordersPayload;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t('orders.loadError'),
      );
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (active) {
        void loadData();
      }
    };

    refresh();
    const refreshInterval = window.setInterval(refresh, 10000);
    const unsubscribeOrders = subscribeToOrdersUpdated((updatedOrders) => {
      if (active) {
        setOrders(updatedOrders);
        setError(null);
        setIsLoading(false);
      }
    });
    const unsubscribeInvalidation = subscribeToDataInvalidated(
      ['orders'],
      refresh,
    );

    return () => {
      active = false;
      window.clearInterval(refreshInterval);
      unsubscribeOrders();
      unsubscribeInvalidation();
    };
  }, [loadData]);

  async function createOrder(input: CreateOrderInput) {
    const payload = await requestApi('/api/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!isOrderList([payload])) {
      throw new Error(t('orders.invalidItem'));
    }

    const refreshed = await loadData();
    if (refreshed) {
      publishOrdersUpdated(refreshed);
    }
    publishDataInvalidated(['orders', 'overview']);
  }

  async function refreshAfterImport() {
    const refreshed = await loadData();
    if (refreshed) {
      publishOrdersUpdated(refreshed);
    }
    publishDataInvalidated(['orders', 'overview']);
  }

  async function assignOrder(orderId: string, input: DispatchOrderInput) {
    setIsDispatching(true);
    try {
      const payload = await requestApi(`/api/v1/orders/${orderId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!isOrderList([payload])) {
        throw new Error(t('orders.invalidItem'));
      }

      const refreshed = await loadData();
      if (refreshed) {
        publishOrdersUpdated(refreshed);
      }
      publishDataInvalidated(['orders', 'fleet', 'driver', 'overview']);
      setDispatchOrder(null);
    } finally {
      setIsDispatching(false);
    }
  }

  async function deleteOrder(order: Order) {
    const confirmed = window.confirm(
      t('orders.deleteConfirm', { code: order.order_code }),
    );
    if (!confirmed) {
      return;
    }

    setDeletingId(order.id);
    setError(null);
    try {
      await requestApi(`/api/v1/orders/${order.id}`, { method: 'DELETE' });
      const refreshed = await loadData();
      if (refreshed) {
        publishOrdersUpdated(refreshed);
      }
      publishDataInvalidated(['orders', 'fleet', 'driver', 'overview']);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t('orders.deleteError'),
      );
    } finally {
      setDeletingId(null);
    }
  }

  const pendingCount = orders.filter((order) => order.status === 'PENDING').length;
  const assignedCount = orders.filter((order) => order.status === 'ASSIGNED').length;
  const failedCount = orders.filter((order) => order.status === 'FAILED').length;
  const deliveredCount = orders.filter((order) => order.status === 'DELIVERED').length;
  const selectedVehicle = selectedOrder?.assigned_vehicle_id
    ? vehicles.find((vehicle) => vehicle.id === selectedOrder.assigned_vehicle_id) ?? null
    : null;
  const closeOrderDetails = useCallback(() => setSelectedOrder(null), []);

  return (
    <section className="space-y-4" aria-labelledby="orders-heading">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="orders-heading" className="text-lg font-semibold text-slate-950 dark:text-white">{t('orders.listTitle')}</h2>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
            <span>{t('orders.summary.total', { count: orders.length })}</span><span aria-hidden="true">·</span>
            <span>{t('orders.summary.pending', { count: pendingCount })}</span><span aria-hidden="true">·</span>
            <span>{t('orders.summary.assigned', { count: assignedCount })}</span><span aria-hidden="true">·</span>
            <span>{t('orders.summary.failed', { count: failedCount })}</span><span aria-hidden="true">·</span>
            <span>{t('orders.summary.delivered', { count: deliveredCount })}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
            type="button"
            onClick={() => setIsCreateOpen(true)}
          >
            <span className="text-lg leading-none" aria-hidden="true">＋</span>
            {t('orders.create')}
          </button>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-teal-400 hover:text-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-teal-600 dark:hover:text-teal-300"
            type="button"
            onClick={() => setIsImportOpen(true)}
          >
            <span className="text-base leading-none" aria-hidden="true">↑</span>
            {t('import.action')}
          </button>
        </div>
      </header>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300" role="alert">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <OrderList
          orders={orders}
          isLoading={isLoading}
          deletingId={deletingId}
          onDelete={(order) => void deleteOrder(order)}
          onDispatch={setDispatchOrder}
          onOpenDetails={setSelectedOrder}
        />
      </div>

      {isCreateOpen && (
        <CreateOrderDialog
          open
          onClose={() => setIsCreateOpen(false)}
          onCreate={createOrder}
        />
      )}
      {isImportOpen && (
        <CsvImportDialog
          open
          onClose={() => setIsImportOpen(false)}
          onImported={refreshAfterImport}
        />
      )}
      <DispatchOrderDialog
        order={dispatchOrder}
        availableDrivers={availableDrivers}
        isSubmitting={isDispatching}
        onClose={() => setDispatchOrder(null)}
        onDispatch={assignOrder}
      />
      <OrderDetailDrawer
        order={selectedOrder}
        vehicle={selectedVehicle}
        onClose={closeOrderDetails}
      />
    </section>
  );
}
