import { describe, expect, it } from 'vitest';

import {
  isSystemDiagnosticsResponse,
  isSystemHealthResponse,
  type SystemDiagnosticsResponse,
  type SystemHealthResponse,
} from './system-contracts';
import { buildSystemAuditReport } from './system-report-export';

const checkedAt = '2026-08-09T10:00:00Z';
const serviceKeys = [
  'database',
  'core_engine',
  'osrm_routing',
  'telemetry',
  'notifications',
  'storage',
] as const;

const health: SystemHealthResponse = {
  overall_status: 'HEALTHY',
  uptime_seconds: 3600,
  server_time: checkedAt,
  services: serviceKeys.map((serviceKey) => ({
    service_key: serviceKey,
    name: serviceKey,
    status: 'HEALTHY',
    latency_ms: 2.5,
    details: { readiness: 'ACTIVE' },
    last_checked_at: checkedAt,
  })),
};

const testKeys = [
  'database_spatial',
  'core_engine_solve',
  'routing_polyline',
  'tracking_token',
  'storage_permissions',
] as const;

const diagnostics: SystemDiagnosticsResponse = {
  overall_status: 'PASS',
  started_at: checkedAt,
  completed_at: '2026-08-09T10:00:00.100Z',
  total_duration_ms: 100,
  passed_count: 5,
  failed_count: 0,
  tests: testKeys.map((testKey) => ({
    test_key: testKey,
    name: testKey,
    status: 'PASS',
    duration_ms: 10,
    detail: 'Synthetic check completed.',
  })),
};

describe('system health API contracts', () => {
  it('accepts complete health and diagnostics responses', () => {
    expect(isSystemHealthResponse(health)).toBe(true);
    expect(isSystemDiagnosticsResponse(diagnostics)).toBe(true);
  });

  it('rejects missing, duplicate, or invalid subsystem data', () => {
    expect(isSystemHealthResponse({
      ...health,
      services: health.services.slice(0, 5),
    })).toBe(false);
    expect(isSystemHealthResponse({
      ...health,
      services: health.services.map((service, index) => (
        index === 1 ? { ...service, service_key: 'database' } : service
      )),
    })).toBe(false);
    expect(isSystemHealthResponse({
      ...health,
      uptime_seconds: -1,
    })).toBe(false);
  });

  it('rejects inconsistent diagnostics counters and statuses', () => {
    expect(isSystemDiagnosticsResponse({
      ...diagnostics,
      passed_count: 4,
    })).toBe(false);
    expect(isSystemDiagnosticsResponse({
      ...diagnostics,
      overall_status: 'FAIL',
    })).toBe(false);
    expect(isSystemDiagnosticsResponse({
      ...diagnostics,
      tests: diagnostics.tests.map((test, index) => (
        index === 0 ? { ...test, status: 'UNKNOWN' } : test
      )),
    })).toBe(false);
  });

  it('builds a structured audit report from the displayed snapshots', () => {
    const report = JSON.parse(buildSystemAuditReport(health, diagnostics, checkedAt));

    expect(report.report_type).toBe('LOGIROUTE_SYSTEM_AUDIT');
    expect(report.generated_at).toBe(checkedAt);
    expect(report.health.services).toHaveLength(6);
    expect(report.diagnostics.tests).toHaveLength(5);
  });
});
