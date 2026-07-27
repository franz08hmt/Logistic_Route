'use client';

import { useEffect, useState } from 'react';

import {
  isOrderList,
  requestApi,
  type CreateOrderInput,
  type Order,
  type OrderStatus,
} from './api-contracts';
import { CreateOrderDialog } from './CreateOrderDialog';
import { subscribeToOrdersUpdated } from './orders-sync';

const weightFormatter = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 1,
});

const statusLabels: Record<OrderStatus, string> = {
  PENDING: 'Chờ phân tuyến',
  ASSIGNED: 'Đã phân tuyến',
  DELIVERED: 'Đã giao',
};

export function OrdersManager() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadOrders() {
      try {
        const payload = await requestApi('/api/v1/orders');
        if (!isOrderList(payload)) {
          throw new Error('API trả về danh sách đơn hàng không hợp lệ.');
        }
        if (active) {
          setOrders(payload);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Không thể tải đơn hàng.',
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadOrders();
    const unsubscribe = subscribeToOrdersUpdated((updatedOrders) => {
      if (active) {
        setOrders(updatedOrders);
        setError(null);
        setIsLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function createOrder(input: CreateOrderInput) {
    const payload = await requestApi('/api/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const createdOrders = [payload];
    if (!isOrderList(createdOrders)) {
      throw new Error('API trả về đơn hàng không hợp lệ.');
    }

    setOrders((current) => [createdOrders[0], ...current]);
  }

  async function deleteOrder(order: Order) {
    const confirmed = window.confirm(
      `Xóa đơn ${order.order_code}? Thao tác này không thể hoàn tác.`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingId(order.id);
    setError(null);
    try {
      await requestApi(`/api/v1/orders/${order.id}`, { method: 'DELETE' });
      setOrders((current) => current.filter((item) => item.id !== order.id));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Không thể xóa đơn hàng.',
      );
    } finally {
      setDeletingId(null);
    }
  }

  const pendingCount = orders.filter((order) => order.status === 'PENDING').length;
  const assignedCount = orders.filter((order) => order.status === 'ASSIGNED').length;

  return (
    <section className="management-workspace" aria-labelledby="orders-heading">
      <header className="management-toolbar">
        <div>
          <h2 id="orders-heading">Danh sách đơn hàng</h2>
          <p>
            {orders.length} đơn · {pendingCount} đang chờ · {assignedCount} đã phân tuyến
          </p>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => setIsCreateOpen(true)}
        >
          <span aria-hidden="true">＋</span>
          Tạo đơn hàng mới
        </button>
      </header>

      {error && <p className="management-alert" role="alert">{error}</p>}

      <div className="table-panel">
        <div className="table-scroll">
          <table className="management-table">
            <caption className="sr-only">Danh sách đơn hàng LogiRoute</caption>
            <thead>
              <tr>
                <th scope="col">Mã đơn</th>
                <th scope="col">Khách hàng</th>
                <th scope="col">Điểm giao</th>
                <th scope="col">Khối lượng</th>
                <th scope="col">Trạng thái</th>
                <th scope="col"><span className="sr-only">Hành động</span></th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 4 }, (_, index) => (
                  <tr className="skeleton-row" key={index} aria-hidden="true">
                    <td colSpan={6}><span /></td>
                  </tr>
                ))}
              {!isLoading && orders.length === 0 && (
                <tr>
                  <td className="table-empty" colSpan={6}>
                    <strong>Chưa có đơn hàng</strong>
                    <span>Tạo đơn đầu tiên để bắt đầu lập kế hoạch giao hàng.</span>
                  </td>
                </tr>
              )}
              {!isLoading && orders.map((order) => (
                <tr key={order.id}>
                  <td><strong>{order.order_code}</strong></td>
                  <td>{order.customer_name}</td>
                  <td>
                    <span className="table-primary">{order.address}</span>
                    <small>{order.latitude.toFixed(4)}, {order.longitude.toFixed(4)}</small>
                  </td>
                  <td>{weightFormatter.format(order.weight_kg)} kg</td>
                  <td>
                    <span className={`status-badge status-${order.status.toLowerCase()}`}>
                      {statusLabels[order.status]}
                    </span>
                  </td>
                  <td className="table-actions">
                    <button
                      className="danger-button"
                      type="button"
                      onClick={() => void deleteOrder(order)}
                      disabled={deletingId === order.id}
                      aria-label={`Xóa đơn ${order.order_code}`}
                    >
                      {deletingId === order.id ? 'Đang xóa…' : 'Xóa'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isCreateOpen && (
        <CreateOrderDialog
          open
          onClose={() => setIsCreateOpen(false)}
          onCreate={createOrder}
        />
      )}
    </section>
  );
}
