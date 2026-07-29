import {
  isAuthUser,
  isRegisterInput,
} from '@/lib/auth/contracts';
import {
  backendErrorResponse,
  backendUrl,
  readJsonSafely,
} from '@/lib/server/backend';

export async function POST(request: Request): Promise<Response> {
  const input: unknown = await request.json().catch(() => null);
  if (!isRegisterInput(input)) {
    return Response.json(
      { detail: 'Thông tin đăng ký không hợp lệ.' },
      { status: 422 },
    );
  }

  try {
    const response = await fetch(backendUrl('/api/v1/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: input.full_name.trim(),
        email: input.email.trim().toLowerCase(),
        password: input.password,
        phone_number: input.phone_number?.trim() || null,
        role: input.role,
      }),
      cache: 'no-store',
    });
    const payload = await readJsonSafely(response);

    if (!response.ok) {
      return backendErrorResponse(payload, response.status);
    }
    if (!isAuthUser(payload) || payload.status !== 'PENDING_APPROVAL') {
      return Response.json(
        { detail: 'Backend trả về tài khoản đăng ký không hợp lệ.' },
        { status: 502 },
      );
    }

    return Response.json({ user: payload }, { status: 201 });
  } catch {
    return Response.json(
      { detail: 'Không thể kết nối tới LogiRoute API trên cổng 8000.' },
      { status: 502 },
    );
  }
}
