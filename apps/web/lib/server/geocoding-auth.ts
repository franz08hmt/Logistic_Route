import { cookies } from 'next/headers';

import { AUTH_COOKIE_NAME, isAuthUser } from '@/lib/auth/contracts';
import { backendUrl, readJsonSafely } from '@/lib/server/backend';


export async function authorizeGeocodingRequest(): Promise<Response | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!accessToken) {
    return Response.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  try {
    const meResponse = await fetch(backendUrl('/api/v1/auth/me'), {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    const user: unknown = await readJsonSafely(meResponse);
    if (!meResponse.ok || !isAuthUser(user)) {
      return Response.json({ detail: 'Not authenticated' }, { status: 401 });
    }
    if (!['ADMIN', 'DISPATCHER'].includes(user.role)) {
      return Response.json({ detail: 'Not authorized' }, { status: 403 });
    }
    return null;
  } catch {
    return Response.json(
      { detail: 'Authentication service is unavailable' },
      { status: 503 },
    );
  }
}
