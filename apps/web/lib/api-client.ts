export const AUTH_UNAUTHORIZED_EVENT = 'logiroute:auth-unauthorized';

export function backendProxyPath(path: string): string {
  if (!path.startsWith('/api/v1/')) {
    throw new Error('Expected an /api/v1 backend path');
  }

  return `/api/backend${path}`;
}

export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(backendProxyPath(path), {
    ...init,
    cache: init?.cache ?? 'no-store',
  });

  if (response.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
  }

  return response;
}
