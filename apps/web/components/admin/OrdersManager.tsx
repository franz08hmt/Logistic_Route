'use client';

import { useCallback, useEffect, useState } from 'react';

import { useI18n } from '@/context/I18nContext';
import { useDepot } from '@/context/DepotContext';
import { withDepotQuery } from '@/components/depot-contracts';
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
import { ArrowUpTrayIcon, PlusIcon } from '@heroicons/react/24/outline';

import type { TranslationKey } from '@/lib/i18n/i18n';

import {
  DataFrame,
  GhostAction,
  HairlineCell,
  HairlineGrid,
  PrimaryAction,
  SectionHeading,
} from '../ui/Section';
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
  const { selectedDepot } = useDepot();
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
        requestApi(withDepotQuery('/api/v1/orders', selectedDepot?.id ?? null)),
        requestApi(withDepotQuery('/api/v1/admin/drivers/available', selectedDepot?.id ?? null)),
        requestApi(withDepotQuery('/api/v1/vehicles', selectedDepot?.id ?? null)),
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
  }, [selectedDepot?.id, t]);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (active) {
        void loadData();
      }
    };

    refresh();
    const refreshInterval = window.setInterval(refresh, 10000);
    // A BroadcastChannel may originate from a tab viewing another depot.
    // Re-fetch the selected depot instead of trusting the cross-tab payload.
    const unsubscribeOrders = subscribeToOrdersUpdated(() => {
      if (active) void loadData();
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
      body: JSON.stringify({ ...input, depot_id: selectedDepot?.id ?? null }),
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

  const ORDER_COUNTS = [
    { labelKey: 'orders.count.total', value: orders.length },
    { labelKey: 'orders.count.pending', value: pendingCount },
    { labelKey: 'orders.count.assigned', value: assignedCount },
    { labelKey: 'orders.count.delivered', value: deliveredCount },
  ] satisfies Array<{ labelKey: TranslationKey; value: number }>;

  return (
    <section className="space-y-8" aria-labelledby="orders-heading">
      {/* No eyebrow here: the page header above already carries it, and
          repeating it reads as a stutter rather than a hierarchy. */}
      <SectionHeading
        id="orders-heading"
        title={t('orders.listTitle')}
        action={(
          <div className="flex flex-col gap-2 sm:flex-row">
            <PrimaryAction
              onClick={() => setIsCreateOpen(true)}
              icon={<PlusIcon aria-hidden="true" className="size-4" strokeWidth={1.6} />}
            >
              {t('orders.create')}
            </PrimaryAction>
            <GhostAction
              onClick={() => setIsImportOpen(true)}
              icon={<ArrowUpTrayIcon aria-hidden="true" className="size-4" strokeWidth={1.6} />}
            >
              {t('import.action')}
            </GhostAction>
          </div>
        )}
      />

      <HairlineGrid columns={4}>
        {ORDER_COUNTS.map(({ labelKey, value }) => (
          <HairlineCell key={labelKey}>
            <article className="px-6 py-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                {t(labelKey)}
              </p>
              <strong className="mt-2 block text-3xl font-extrabold tabular-nums text-slate-950 dark:text-white">
                {value}
              </strong>
            </article>
          </HairlineCell>
        ))}
      </HairlineGrid>

      {error && (
        <p className="rounded-sm border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300" role="alert">
          {error}
        </p>
      )}

      <DataFrame>
        <OrderList
          orders={orders}
          isLoading={isLoading}
          deletingId={deletingId}
          onDelete={(order) => void deleteOrder(order)}
          onDispatch={setDispatchOrder}
          onOpenDetails={setSelectedOrder}
        />
      </DataFrame>

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
          depotId={selectedDepot?.id ?? null}
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
