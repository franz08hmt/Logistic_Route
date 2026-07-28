'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { useAuth } from '@/context/AuthContext';
import { requestApi } from '@/components/admin/api-contracts';
import { ModalDialog } from '@/components/admin/ModalDialog';

import {
  DRIVER_ORDER_STATUSES,
  isDriverRoute,
  isDriverStop,
  type DriverOrderStatus,
  type DriverRoute,
  type DriverStop,
} from './driver-contracts';

const statusLabels: Record<DriverOrderStatus, string> = {
  ASSIGNED: 'Đã phân công',
  DELIVERING: 'Đang giao',
  DELIVERED: 'Đã giao',
  FAILED: 'Giao thất bại',
};

const terminalStatuses = new Set<DriverOrderStatus>(['DELIVERED', 'FAILED']);
const updateStatuses: DriverOrderStatus[] = ['DELIVERED', 'FAILED'];

function routeStatusClass(status: DriverOrderStatus): string {
  return `driver-status driver-status-${status.toLowerCase()}`;
}

function mapNavigationUrl(stop: DriverStop): string {
  const destination = encodeURIComponent(`${stop.latitude},${stop.longitude}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

export function DriverWorkspace() {
  const { user } = useAuth();
  const [route, setRoute] = useState<DriverRoute | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStop, setSelectedStop] = useState<DriverStop | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<DriverOrderStatus>('DELIVERED');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [podUrl, setPodUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadRoute() {
      try {
        const payload = await requestApi('/api/v1/driver/route', {
          signal: controller.signal,
        });
        if (!isDriverRoute(payload)) {
          throw new Error('API returned an invalid driver route');
        }
        setRoute(payload);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') {
          return;
        }
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Không thể tải lộ trình tài xế.',
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadRoute();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const progressLabel = useMemo(() => {
    if (!route) {
      return '—/— đơn';
    }
    return `${route.completed_orders}/${route.total_orders} đơn`;
  }, [route]);

  function openStatusDialog(stop: DriverStop) {
    setSelectedStop(stop);
    setSelectedStatus('DELIVERED');
    setDeliveryNote(stop.delivery_note ?? '');
    setPodUrl(stop.pod_url ?? '');
    setError(null);
  }

  function closeStatusDialog() {
    if (!isSubmitting) {
      setSelectedStop(null);
    }
  }

  async function handleStatusSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStop) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = await requestApi(
        `/api/v1/driver/orders/${selectedStop.id}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: selectedStatus,
            delivery_note: deliveryNote.trim() || null,
            pod_url: podUrl.trim() || null,
          }),
        },
      );
      if (!isDriverStop(payload)) {
        throw new Error('API returned an invalid order status response');
      }

      setRoute((currentRoute) => {
        if (!currentRoute) {
          return currentRoute;
        }

        const stops = currentRoute.stops.map((stop) =>
          stop.id === payload.id ? payload : stop,
        );
        return {
          ...currentRoute,
          stops,
          completed_orders: stops.filter((stop) => stop.status === 'DELIVERED').length,
        };
      });
      setToast(`Đã cập nhật ${payload.order_code}: ${statusLabels[payload.status]}.`);
      setSelectedStop(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Không thể cập nhật trạng thái đơn hàng.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <div className="driver-loading" role="status" aria-busy="true">Đang tải lộ trình hôm nay…</div>;
  }

  return (
    <section className="driver-workspace" aria-labelledby="driver-heading">
      {toast && <div className="success-toast driver-toast" role="status">✓ {toast}</div>}

      <header className="driver-header">
        <div>
          <span className="eyebrow">Driver workspace</span>
          <h1 id="driver-heading">Chào {user?.full_name ?? 'tài xế'}</h1>
          <p className="muted">Lộ trình giao hàng được phân công cho hôm nay.</p>
        </div>
        {route && (
          <div className="driver-vehicle-card">
            <span className="driver-vehicle-icon" aria-hidden="true">🚚</span>
            <span>
              <small>Xe được giao</small>
              <strong>{route.vehicle.license_plate}</strong>
              <em>{route.vehicle.status === 'ON_ROUTE' ? 'Đang hoạt động' : 'Sẵn sàng'}</em>
            </span>
          </div>
        )}
      </header>

      {error && <p className="management-alert" role="alert">{error}</p>}

      {route && (
        <>
          <div className="driver-summary" aria-label="Tổng quan lộ trình">
            <article>
              <span>Đơn hôm nay</span>
              <strong>{route.total_orders}</strong>
              <small>điểm giao</small>
            </article>
            <article>
              <span>Tiến độ</span>
              <strong>{progressLabel}</strong>
              <small>đã hoàn thành</small>
            </article>
            <article>
              <span>Điểm xuất phát</span>
              <strong>Quận 12</strong>
              <small>LogiRoute Depot</small>
            </article>
          </div>

          <div className="driver-route-heading">
            <div>
              <span className="eyebrow">Today&apos;s route</span>
              <h2>Lộ trình giao hàng</h2>
            </div>
            <span className="driver-stop-count">{route.stops.length} điểm giao</span>
          </div>

          {route.stops.length === 0 ? (
            <div className="driver-empty" role="status">
              <span aria-hidden="true">✓</span>
              <strong>Chưa có điểm giao được phân công</strong>
              <p>Điều phối viên sẽ cập nhật lộ trình khi có đơn mới.</p>
            </div>
          ) : (
            <ol className="driver-timeline">
              {route.stops.map((stop) => {
                const isTerminal = terminalStatuses.has(stop.status);
                return (
                  <li className={`driver-stop ${isTerminal ? 'driver-stop-complete' : ''}`} key={stop.id}>
                    <div className="driver-stop-marker" aria-hidden="true">{stop.stop_sequence}</div>
                    <article className="driver-stop-card">
                      <header>
                        <div>
                          <small>STOP {String(stop.stop_sequence).padStart(2, '0')} · {stop.order_code}</small>
                          <h3>{stop.customer_name}</h3>
                        </div>
                        <span className={routeStatusClass(stop.status)}>{statusLabels[stop.status]}</span>
                      </header>
                      <div className="driver-stop-details">
                        <p><span aria-hidden="true">⌖</span>{stop.address}</p>
                        <p>
                          <span aria-hidden="true">☎</span>
                          {stop.customer_phone ? (
                            <a href={`tel:${stop.customer_phone}`}>{stop.customer_phone}</a>
                          ) : 'Chưa có số điện thoại'}
                        </p>
                        <p><span aria-hidden="true">◈</span>{stop.weight_kg} kg</p>
                      </div>
                      {stop.delivery_note && <p className="driver-note">Ghi chú: {stop.delivery_note}</p>}
                      {stop.failure_reason && <p className="driver-note driver-failure-note">Lý do thất bại: {stop.failure_reason}</p>}
                      <footer className="driver-stop-actions">
                        <a
                          className="secondary-button driver-nav-button"
                          href={mapNavigationUrl(stop)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          ↗ Mở bản đồ Nav
                        </a>
                        <button
                          className="primary-button driver-update-button"
                          type="button"
                          onClick={() => openStatusDialog(stop)}
                          disabled={isTerminal}
                        >
                          {isTerminal ? 'Đã xử lý' : 'Cập nhật trạng thái'}
                        </button>
                      </footer>
                    </article>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}

      <ModalDialog
        open={selectedStop !== null}
        title="Cập nhật trạng thái giao hàng"
        description={selectedStop ? `${selectedStop.order_code} · ${selectedStop.customer_name}` : ''}
        onClose={closeStatusDialog}
      >
        <form className="management-form driver-status-form" onSubmit={handleStatusSubmit}>
          <label>
            Trạng thái mới
            <select
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value as DriverOrderStatus)}
              disabled={isSubmitting}
            >
              {updateStatuses.map((status) => (
                <option key={status} value={status}>{statusLabels[status]}</option>
              ))}
            </select>
          </label>
          <label>
            Ghi chú giao hàng
            <textarea
              value={deliveryNote}
              onChange={(event) => setDeliveryNote(event.target.value)}
              maxLength={2000}
              placeholder="Ví dụ: Đã giao cho bảo vệ tầng trệt"
              rows={4}
              disabled={isSubmitting}
            />
          </label>
          <label>
            URL ảnh xác nhận (POD)
            <input
              type="url"
              value={podUrl}
              onChange={(event) => setPodUrl(event.target.value)}
              placeholder="https://..."
              disabled={isSubmitting}
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <footer className="dialog-actions">
            <button className="secondary-button" type="button" onClick={closeStatusDialog} disabled={isSubmitting}>Hủy</button>
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Đang lưu…' : 'Lưu trạng thái'}
            </button>
          </footer>
        </form>
      </ModalDialog>
    </section>
  );
}
