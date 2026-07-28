'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type Overview = {
  active_orders_count: number;
  assigned_orders_count: number;
  delivered_orders_count: number;
  failed_orders_count: number;
  vehicles_count: number;
  drivers_online_count: number;
  routes_optimized_count: number;
  estimated_operating_cost_vnd: number;
  estimated_savings_vnd: number;
  co2_emissions_kg: number;
  estimated_co2_savings_kg: number;
};

const cardDefinitions = [
  ['Active orders', 'active_orders_count'],
  ['Assigned orders', 'assigned_orders_count'],
  ['Delivered orders', 'delivered_orders_count'],
  ['Failed orders', 'failed_orders_count'],
  ['Vehicles', 'vehicles_count'],
  ['Drivers online', 'drivers_online_count'],
  ['Routes optimized', 'routes_optimized_count'],
] as const;

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 0,
  style: 'currency',
  currency: 'VND',
});
const decimalFormatter = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 2,
});

export function DashboardOverview() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadOverview() {
      try {
        const response = await apiFetch('/api/v1/overview', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }
        setOverview((await response.json()) as Overview);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') {
          return;
        }
        setError('Unable to load live metrics. Is the API running on port 8000?');
      }
    }

    void loadOverview();
    return () => controller.abort();
  }, []);

  return (
    <>
      <div className="grid" aria-label="Live operations metrics">
        {cardDefinitions.map(([label, key]) => (
          <section className="card" key={key}>
            <h2>{label}</h2>
            <p>{overview ? overview[key] : '—'}</p>
          </section>
        ))}
      </div>
      <section className="dashboard-analytics" aria-labelledby="analytics-title">
        <div className="dashboard-analytics-heading">
          <span className="eyebrow">Cost & sustainability</span>
          <h2 id="analytics-title">Hiệu quả vận hành gần nhất</h2>
        </div>
        <div className="dashboard-analytics-grid">
          <article>
            <span>Tổng chi phí vận hành ước tính</span>
            <strong>
              {overview
                ? currencyFormatter.format(overview.estimated_operating_cost_vnd)
                : '—'}
            </strong>
            <small>
              {overview
                ? `AI ước tính tiết kiệm ${currencyFormatter.format(overview.estimated_savings_vnd)}`
                : 'Đang chờ dữ liệu tối ưu tuyến'}
            </small>
          </article>
          <article>
            <span>Tổng CO₂ cắt giảm</span>
            <strong>
              {overview
                ? `${decimalFormatter.format(overview.estimated_co2_savings_kg)} kg`
                : '—'}
            </strong>
            <small>
              {overview
                ? `Phát thải lộ trình ước tính ${decimalFormatter.format(overview.co2_emissions_kg)} kg`
                : 'Đang chờ dữ liệu tối ưu tuyến'}
            </small>
          </article>
        </div>
      </section>
      <p className={error ? 'metric-state error' : 'metric-state'} aria-live="polite">
        {error ?? (overview ? 'Live data from LogiRoute API' : 'Loading live metrics…')}
      </p>
    </>
  );
}
