'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import {
  isOrderList,
  requestApi,
} from '../admin/api-contracts';
import { publishOrdersUpdated } from '../admin/orders-sync';
import { getOptimizationSuccessMessage } from './optimization-feedback';
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

export function RouteOptimizationPanel() {
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
            Phân đơn PENDING theo tải trọng xe và tối thiểu hóa tổng quãng đường.
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
            : '⚡ Chạy Tối Ưu Tuyến Đường (Optimize Routes)'}
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
        <RouteMap result={result} />
      </div>
    </section>
  );
}
