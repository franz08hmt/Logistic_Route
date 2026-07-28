import { cookies } from 'next/headers';

import { AUTH_COOKIE_NAME } from '@/lib/auth/contracts';
import { backendUrl } from '@/lib/server/backend';

type BackendRouteContext = {
  params: Promise<{ path: string[] }>;
};

const methodsWithoutBody = new Set(['GET', 'HEAD']);

async function forwardToBackend(
  request: Request,
  context: BackendRouteContext,
): Promise<Response> {
  const { path } = await context.params;
  const backendPath = path.join('/');

  if (!backendPath.startsWith('api/v1/')) {
    return Response.json({ detail: 'Route not found' }, { status: 404 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return Response.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const sourceUrl = new URL(request.url);
  const headers = new Headers({
    Accept: request.headers.get('accept') ?? 'application/json',
    Authorization: `Bearer ${token}`,
  });
  const contentType = request.headers.get('content-type');
  if (contentType) {
    headers.set('Content-Type', contentType);
  }

  try {
    const response = await fetch(
      `${backendUrl(`/${backendPath}`)}${sourceUrl.search}`,
      {
        method: request.method,
        headers,
        body: methodsWithoutBody.has(request.method)
          ? undefined
          : await request.arrayBuffer(),
        cache: 'no-store',
      },
    );

    if (response.status === 401) {
      cookieStore.delete(AUTH_COOKIE_NAME);
    }

    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type':
          response.headers.get('content-type') ?? 'application/json',
      },
    });
  } catch {
    return Response.json(
      { detail: 'Không thể kết nối tới LogiRoute API trên cổng 8000.' },
      { status: 502 },
    );
  }
}

export const GET = forwardToBackend;
export const POST = forwardToBackend;
export const PUT = forwardToBackend;
export const PATCH = forwardToBackend;
export const DELETE = forwardToBackend;
