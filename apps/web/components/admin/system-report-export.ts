import type {
  SystemDiagnosticsResponse,
  SystemHealthResponse,
} from './system-contracts';

export function buildSystemAuditReport(
  health: SystemHealthResponse,
  diagnostics: SystemDiagnosticsResponse,
  generatedAt = new Date().toISOString(),
): string {
  return `${JSON.stringify({
    report_type: 'LOGIROUTE_SYSTEM_AUDIT',
    report_version: 1,
    generated_at: generatedAt,
    health,
    diagnostics,
  }, null, 2)}\n`;
}

export function downloadSystemAuditReport(
  health: SystemHealthResponse,
  diagnostics: SystemDiagnosticsResponse,
): void {
  const blob = new Blob(
    [buildSystemAuditReport(health, diagnostics)],
    { type: 'application/json;charset=utf-8' },
  );
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `logiroute-system-audit-${new Date().toISOString().slice(0, 10)}.json`;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
