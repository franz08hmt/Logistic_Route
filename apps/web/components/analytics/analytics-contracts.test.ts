import { describe, expect, it } from 'vitest';

import { isAnalyticsHistory } from './analytics-contracts';

const response = {
  summary: {
    period_label: '30 ngày gần nhất',
    total_optimizations: 2,
    total_distance_km: 125.5,
    total_cost_vnd: 1_240_000,
    total_savings_vnd: 223_200,
    total_co2_saved_kg: 7.2,
    avg_savings_rate: 0.18,
    best_day: '2026-07-30',
    best_day_savings_vnd: 120_000,
  },
  data_points: [
    {
      date: '2026-07-30',
      total_distance_km: 125.5,
      total_duration_mins: 240,
      total_cost_vnd: 1_240_000,
      fuel_cost_vnd: 340_000,
      driver_cost_vnd: 900_000,
      co2_emissions_kg: 34.8,
      estimated_savings_vnd: 223_200,
      estimated_co2_savings_kg: 7.2,
      optimization_runs: 2,
    },
  ],
};

describe('analytics API contract', () => {
  it('accepts a complete analytics history response', () => {
    expect(isAnalyticsHistory(response)).toBe(true);
  });

  it('rejects malformed dates, rates and missing metrics', () => {
    expect(isAnalyticsHistory({
      ...response,
      data_points: [{ ...response.data_points[0], date: '30/07/2026' }],
    })).toBe(false);
    expect(isAnalyticsHistory({
      ...response,
      summary: { ...response.summary, avg_savings_rate: 1.2 },
    })).toBe(false);
    expect(isAnalyticsHistory({
      ...response,
      data_points: [{ ...response.data_points[0], fuel_cost_vnd: undefined }],
    })).toBe(false);
  });
});
