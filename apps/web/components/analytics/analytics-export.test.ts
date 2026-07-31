import { describe, expect, it } from 'vitest';

import type { AnalyticsDataPoint } from './analytics-contracts';
import { buildAnalyticsCsv } from './analytics-export';

const points: AnalyticsDataPoint[] = [
  {
    date: '2026-07-30',
    total_distance_km: 85.2,
    total_duration_mins: 160,
    fuel_cost_vnd: 240_264,
    driver_cost_vnd: 400_000,
    total_cost_vnd: 640_264,
    co2_emissions_kg: 23.616,
    estimated_savings_vnd: 115_247.52,
    estimated_co2_savings_kg: 4.251,
    optimization_runs: 2,
  },
];

describe('analytics CSV export', () => {
  it('exports all analytics columns with an Excel-compatible UTF-8 BOM', () => {
    const csv = buildAnalyticsCsv(points, {
      date: 'Ngày',
      distance: 'Quãng đường (km)',
      duration: 'Thời gian (phút)',
      fuelCost: 'Chi phí nhiên liệu (VND)',
      driverCost: 'Chi phí tài xế (VND)',
      totalCost: 'Tổng chi phí (VND)',
      savings: 'Tiết kiệm (VND)',
      co2: 'CO2 (kg)',
      co2Saved: 'CO2 cắt giảm (kg)',
      runs: 'Lượt tối ưu',
    });

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"2026-07-30"');
    expect(csv).toContain('"85.2"');
    expect(csv).toContain('"115247.52"');
    expect(csv).toContain('"Lượt tối ưu"');
  });
});
