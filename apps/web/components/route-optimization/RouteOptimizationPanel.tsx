'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
const numberFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });

export function RouteOptimizationPanel() {
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function optimizeRoutes() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/routes/optimize`, {
        method: 'POST',
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        const detail =
          typeof payload === 'object' &&
          payload !== null &&
          'detail' in payload &&
          typeof payload.detail === 'string'
            ? payload.detail
            : `API returned ${response.status}`;
        throw new Error(detail);
      }
      if (!isOptimizationResult(payload)) {
        throw new Error('API returned an invalid optimization result');
      }

      setResult(payload);
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
