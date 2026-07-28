import { cookies } from 'next/headers';

import {
  AUTH_COOKIE_NAME,
  isAuthUser,
  isLoginInput,
  isRecord,
} from '@/lib/auth/contracts';
import {
  backendErrorResponse,
  backendUrl,
  readJsonSafely,
} from '@/lib/server/backend';

const ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 60;

export async function POST(request: Request): Promise<Response> {
  const input: unknown = await request.json().catch(() => null);
  if (!isLoginInput(input)) {
    return Response.json(
      { detail: 'Email và mật khẩu là bắt buộc.' },
      { status: 422 },
    );
  }

  try {
    const loginResponse = await fetch(backendUrl('/api/v1/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: input.email.trim().toLowerCase(),
        password: input.password,
      }),
      cache: 'no-store',
    });
    const loginPayload = await readJsonSafely(loginResponse);

    if (!loginResponse.ok) {
      return backendErrorResponse(loginPayload, loginResponse.status);
    }
    if (
      !isRecord(loginPayload) ||
      typeof loginPayload.access_token !== 'string' ||
      loginPayload.token_type !== 'bearer'
    ) {
      return Response.json(
        { detail: 'Backend trả về phiên đăng nhập không hợp lệ.' },
        { status: 502 },
      );
    }

    const meResponse = await fetch(backendUrl('/api/v1/auth/me'), {
      headers: { Authorization: `Bearer ${loginPayload.access_token}` },
      cache: 'no-store',
    });
    const mePayload = await readJsonSafely(meResponse);

    if (!meResponse.ok) {
      return backendErrorResponse(mePayload, meResponse.status);
    }
    if (!isAuthUser(mePayload)) {
      return Response.json(
        { detail: 'Backend trả về thông tin người dùng không hợp lệ.' },
        { status: 502 },
      );
    }

    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, loginPayload.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
      path: '/',
    });

    return Response.json({ user: mePayload });
  } catch {
    return Response.json(
      { detail: 'Không thể kết nối tới LogiRoute API trên cổng 8000.' },
      { status: 502 },
    );
  }
}
