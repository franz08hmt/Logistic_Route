import 'server-only';

const configuredApiBaseUrl =
  process.env.LOGIROUTE_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:8000';

export const BACKEND_API_BASE_URL = configuredApiBaseUrl.replace(/\/+$/, '');

export function backendUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${BACKEND_API_BASE_URL}${normalizedPath}`;
}

export async function readJsonSafely(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

export function backendErrorResponse(payload: unknown, status: number): Response {
  const detail =
    typeof payload === 'object' &&
    payload !== null &&
    'detail' in payload &&
    typeof payload.detail === 'string'
      ? payload.detail
      : 'Backend request failed';

  return Response.json({ detail }, { status });
}
