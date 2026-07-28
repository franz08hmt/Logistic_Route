import { cookies } from 'next/headers';

import { AUTH_COOKIE_NAME } from '@/lib/auth/contracts';

export async function POST(): Promise<Response> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
  return new Response(null, { status: 204 });
}
