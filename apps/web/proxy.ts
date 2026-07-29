import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { AUTH_COOKIE_NAME } from '@/lib/auth/contracts';
import { getRouteAccessDecision } from '@/lib/auth/route-access';

export function proxy(request: NextRequest): NextResponse {
  const decision = getRouteAccessDecision(
    request.nextUrl.pathname,
    request.cookies.has(AUTH_COOKIE_NAME),
  );

  if (decision === 'login') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (decision === 'dashboard') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/orders/:path*',
    '/dispatch/:path*',
    '/drivers/:path*',
    '/fleet/:path*',
    '/map/:path*',
    '/driver/:path*',
    '/admin/:path*',
    '/login',
    '/register',
  ],
};
