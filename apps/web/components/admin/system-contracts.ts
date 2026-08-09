export const SYSTEM_SERVICE_KEYS = [
  'database',
  'core_engine',
  'osrm_routing',
  'telemetry',
  'notifications',
  'storage',
] as const;

export const SYSTEM_HEALTH_STATUSES = ['HEALTHY', 'DEGRADED', 'DOWN'] as const;
export const DIAGNOSTIC_TEST_KEYS = [
  'database_spatial',
  'core_engine_solve',
  'routing_polyline',
  'tracking_token',
  'storage_permissions',
] as const;

export type SystemServiceKey = (typeof SYSTEM_SERVICE_KEYS)[number];
export type SystemHealthStatus = (typeof SYSTEM_HEALTH_STATUSES)[number];
export type DiagnosticTestKey = (typeof DIAGNOSTIC_TEST_KEYS)[number];
export type DiagnosticStatus = 'PASS' | 'FAIL';

export type ServiceHealthItem = {
  service_key: SystemServiceKey;
  name: string;
  status: SystemHealthStatus;
  latency_ms: number | null;
  details: Record<string, unknown>;
  last_checked_at: string;
};

export type SystemHealthResponse = {
  overall_status: SystemHealthStatus;
  uptime_seconds: number;
  server_time: string;
  services: ServiceHealthItem[];
};

export type DiagnosticTestResult = {
  test_key: DiagnosticTestKey;
  name: string;
  status: DiagnosticStatus;
  duration_ms: number;
  detail: string;
};

export type SystemDiagnosticsResponse = {
  overall_status: DiagnosticStatus;
  started_at: string;
  completed_at: string;
  total_duration_ms: number;
  passed_count: number;
  failed_count: number;
  tests: DiagnosticTestResult[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
}

function isServiceHealthItem(value: unknown): value is ServiceHealthItem {
  if (!isRecord(value)) return false;
  return (
    SYSTEM_SERVICE_KEYS.includes(value.service_key as SystemServiceKey)
    && typeof value.name === 'string'
    && value.name.length > 0
    && SYSTEM_HEALTH_STATUSES.includes(value.status as SystemHealthStatus)
    && (value.latency_ms === null || isFiniteNonNegative(value.latency_ms))
    && isRecord(value.details)
    && isIsoDate(value.last_checked_at)
  );
}

function expectedOverallStatus(services: ServiceHealthItem[]): SystemHealthStatus {
  const criticalDown = services.some((service) => (
    (service.service_key === 'database' || service.service_key === 'core_engine')
    && service.status === 'DOWN'
  ));
  if (criticalDown) return 'DOWN';
  return services.some((service) => service.status !== 'HEALTHY') ? 'DEGRADED' : 'HEALTHY';
}

export function isSystemHealthResponse(value: unknown): value is SystemHealthResponse {
  if (!isRecord(value) || !Array.isArray(value.services) || value.services.length !== 6) {
    return false;
  }
  if (!value.services.every(isServiceHealthItem)) return false;
  const serviceKeys = new Set(value.services.map((service) => service.service_key));
  return (
    serviceKeys.size === SYSTEM_SERVICE_KEYS.length
    && SYSTEM_SERVICE_KEYS.every((serviceKey) => serviceKeys.has(serviceKey))
    && SYSTEM_HEALTH_STATUSES.includes(value.overall_status as SystemHealthStatus)
    && value.overall_status === expectedOverallStatus(value.services)
    && isNonNegativeInteger(value.uptime_seconds)
    && isIsoDate(value.server_time)
  );
}

function isDiagnosticTestResult(value: unknown): value is DiagnosticTestResult {
  if (!isRecord(value)) return false;
  return (
    DIAGNOSTIC_TEST_KEYS.includes(value.test_key as DiagnosticTestKey)
    && typeof value.name === 'string'
    && value.name.length > 0
    && (value.status === 'PASS' || value.status === 'FAIL')
    && isFiniteNonNegative(value.duration_ms)
    && typeof value.detail === 'string'
    && value.detail.length > 0
  );
}

export function isSystemDiagnosticsResponse(
  value: unknown,
): value is SystemDiagnosticsResponse {
  if (!isRecord(value) || !Array.isArray(value.tests) || value.tests.length !== 5) {
    return false;
  }
  if (!value.tests.every(isDiagnosticTestResult)) return false;
  const testKeys = new Set(value.tests.map((test) => test.test_key));
  const passedCount = value.tests.filter((test) => test.status === 'PASS').length;
  const failedCount = value.tests.length - passedCount;
  const expectedOverall = failedCount === 0 ? 'PASS' : 'FAIL';
  return (
    testKeys.size === DIAGNOSTIC_TEST_KEYS.length
    && DIAGNOSTIC_TEST_KEYS.every((testKey) => testKeys.has(testKey))
    && value.overall_status === expectedOverall
    && isIsoDate(value.started_at)
    && isIsoDate(value.completed_at)
    && isFiniteNonNegative(value.total_duration_ms)
    && value.passed_count === passedCount
    && value.failed_count === failedCount
  );
}
