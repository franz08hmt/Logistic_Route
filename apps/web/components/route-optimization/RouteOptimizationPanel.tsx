'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import {
  isOrderList,
  requestApi,
  type Order,
} from '../admin/api-contracts';
import { publishOrdersUpdated } from '../admin/orders-sync';
import { getOptimizationSuccessMessage } from './optimization-feedback';
import { downloadManifestCsv } from './manifest-export';
import {
  isOptimizationResult,
  type OptimizationResult,
} from './types';

const RouteMap = dynamic(
  () => import('./RouteMap').then((module) => module.RouteMap),
  {
    ssr: false,
    loading: () => (
      <section
        className="route-map route-map-loading"
        aria-label="Đang tải bản đồ"
        aria-busy="true"
      >
        <span className="button-spinner" aria-hidden="true" />
        <p>Đang tải bản đồ OpenStreetMap…</p>
      </section>
    ),
  },
);

const numberFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 0,
  style: 'currency',
  currency: 'VND',
});

export function RouteOptimizationPanel() {
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    let active = true;

    async function loadOrders() {
      try {
        const payload = await requestApi('/api/v1/orders');
        if (active && isOrderList(payload)) {
          setOrders(payload);
        }
      } catch {
        // The optimization result remains usable if this background refresh fails.
      }
    }

    void loadOrders();
    const refreshInterval = window.setInterval(() => {
      void loadOrders();
    }, 10000);
    return () => {
      active = false;
      window.clearInterval(refreshInterval);
    };
  }, []);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToastMessage(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [toastMessage]);

  async function optimizeRoutes() {
    setIsLoading(true);
    setError(null);

    try {
      const payload = await requestApi('/api/v1/routes/optimize', {
        method: 'POST',
      });
      if (!isOptimizationResult(payload)) {
        throw new Error('API returned an invalid optimization result');
      }

      setResult(payload);
      const assignedOrderCount = payload.routes.reduce(
        (total, route) => total + route.stops.length,
        0,
      );
      setToastMessage(getOptimizationSuccessMessage(assignedOrderCount));

      try {
        const ordersPayload = await requestApi('/api/v1/orders');
        if (!isOrderList(ordersPayload)) {
          throw new Error('API returned an invalid order list after optimization');
        }
        setOrders(ordersPayload);
        publishOrdersUpdated(ordersPayload);
      } catch {
        setError(
          'Tuyến đã được tối ưu, nhưng danh sách đơn hàng chưa đồng bộ. Hãy tải lại trang Orders.',
        );
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Không thể chạy tối ưu tuyến đường.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  const assignedStops = result?.routes.reduce(
    (total, route) => total + route.stops.length,
    0,
  ) ?? 0;

  function exportManifest() {
    if (!result || result.routes.length === 0) {
      return;
    }

    downloadManifestCsv(result, orders);
    setToastMessage('Đã xuất phiếu lộ trình CSV theo đúng thứ tự giao hàng.');
  }

  return (
    <section className="optimization-workspace">
      {toastMessage && (
        <div className="success-toast" role="status" aria-live="polite">
          <span className="success-toast-icon" aria-hidden="true">✓</span>
          <p>{toastMessage}</p>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            aria-label="Đóng thông báo"
          >
            ×
          </button>
        </div>
      )}
      <div className="optimization-toolbar">
        <div>
          <p className="toolbar-kicker">VRP Engine · OR-Tools</p>
          <p className="muted">
            Gom đơn PENDING và FAILED theo tải trọng xe, sau đó tối thiểu hóa tổng quãng đường.
          </p>
        </div>
        <button
          className="optimize-button"
          type="button"
          onClick={optimizeRoutes}
          disabled={isLoading}
          aria-busy={isLoading}
        >
          {isLoading && <span className="button-spinner" aria-hidden="true" />}
          {isLoading
            ? 'Đang tính toán tuyến…'
            : '⚡ Re-Optimize Pending & Failed Routes'}
        </button>
      </div>

      {error && <p className="optimization-alert" role="alert">{error}</p>}
      <div className="optimization-summary" aria-live="polite">
        <article>
          <span>Tổng quãng đường</span>
          <strong>{result ? numberFormatter.format(result.total_distance_km) : '—'} km</strong>
        </article>
        <article>
          <span>Thời gian ước tính</span>
          <strong>{result ? numberFormatter.format(result.total_duration_mins) : '—'} phút</strong>
        </article>
        <article>
          <span>Xe được điều phối</span>
          <strong>{result?.routes.length ?? '—'}</strong>
        </article>
        <article>
          <span>Điểm giao đã gán</span>
          <strong>{result ? assignedStops : '—'}</strong>
        </article>
      </div>

      <section className="route-cost-summary" aria-labelledby="route-cost-title">
        <div className="route-cost-heading">
          <div>
            <span className="eyebrow">Route cost summary</span>
            <h2 id="route-cost-title">Kế toán chi phí lộ trình</h2>
            <p>
              Ước tính theo quãng đường, thời gian chạy và định mức nhiên liệu hiện tại.
            </p>
          </div>
          <button
            className="manifest-button"
            type="button"
            onClick={exportManifest}
            disabled={!result || result.routes.length === 0}
          >
            <span aria-hidden="true">↓</span>
            Xuất Phiếu Lộ Trình
          </button>
        </div>
        <div className="route-cost-grid" aria-live="polite">
          <article>
            <span>Chi phí ước tính</span>
            <strong>
              {result
                ? currencyFormatter.format(result.cost_metrics.total_cost_vnd)
                : '—'}
            </strong>
            <small>
              {result
                ? `Nhiên liệu ${currencyFormatter.format(result.cost_metrics.fuel_cost_vnd)} · Tài xế ${currencyFormatter.format(result.cost_metrics.driver_cost_vnd)}`
                : 'Chạy tối ưu để tính chi phí'}
            </small>
          </article>
          <article className="cost-saving-card">
            <span>Tiết kiệm nhờ AI</span>
            <strong>
              {result
                ? currencyFormatter.format(result.cost_metrics.estimated_savings_vnd)
                : '—'}
            </strong>
            <small>
              {result
                ? `Ước tính ~${numberFormatter.format(result.cost_metrics.savings_rate * 100)}% so với tuyến thủ công`
                : 'Mô hình so sánh sẽ xuất hiện tại đây'}
            </small>
          </article>
          <article>
            <span>Phát thải CO₂</span>
            <strong>
              {result
                ? `${numberFormatter.format(result.cost_metrics.co2_emissions_kg)} kg`
                : '—'}
            </strong>
            <small>
              {result
                ? `Ước tính giảm ${numberFormatter.format(result.cost_metrics.estimated_co2_savings_kg)} kg CO₂`
                : 'Theo hệ số 2,31 kg CO₂/lít'}
            </small>
          </article>
        </div>
      </section>

      <div className="optimization-layout">
        <aside className="route-sidebar" aria-label="Optimized route list">
          <div className="route-sidebar-heading">
            <div>
              <span className="eyebrow">Routes</span>
              <h2>Điều phối đội xe</h2>
            </div>
            {result && <span className="solver-status">{result.status}</span>}
          </div>

          {!result && (
            <div className="route-empty">
              <p>Kết quả từng xe sẽ xuất hiện tại đây.</p>
            </div>
          )}
          {result?.routes.length === 0 && (
            <div className="route-empty" role="status">
              <p>Không còn đơn hàng PENDING cần phân tuyến.</p>
            </div>
          )}
          {result?.routes.map((route, index) => (
            <details className="route-card" key={route.vehicle_id} open={index === 0}>
              <summary>
                <span>
                  <small>XE {index + 1}</small>
                  <strong>{route.license_plate}</strong>
                </span>
                <span>{numberFormatter.format(route.distance_km)} km</span>
              </summary>
              <div className="route-card-body">
                <p>
                  <strong>{numberFormatter.format(route.total_weight_kg)} kg</strong>
                  {' · '}
                  {route.stops.length} điểm giao
                </p>
                <ol>
                  {route.stops.map((stop) => (
                    <li key={stop.order_id}>
                      <span>{stop.stop_sequence}</span>
                      <p>{stop.address}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </details>
          ))}

          {!!result?.unassigned_orders.length && (
            <div className="unassigned-warning" role="status">
              <strong>{result.unassigned_orders.length} đơn chưa thể phân công</strong>
              <span>Kiểm tra lại tải trọng xe hoặc khối lượng đơn hàng.</span>
            </div>
          )}
        </aside>
        <RouteMap result={result} orders={orders} />
      </div>
    </section>
  );
}
