const protectedRoutePrefixes = [
  '/dashboard',
  '/orders',
  '/dispatch',
  '/drivers',
  '/fleet',
  '/analytics',
  '/map',
  '/driver',
  '/admin',
];
const guestOnlyRoutes = ['/login', '/register'];

export type RouteAccessDecision = 'allow' | 'login' | 'dashboard';

export function getRouteAccessDecision(
  pathname: string,
  hasSession: boolean,
): RouteAccessDecision {
  const isProtectedRoute = protectedRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtectedRoute && !hasSession) {
    return 'login';
  }

  if (guestOnlyRoutes.includes(pathname) && hasSession) {
    return 'dashboard';
  }

  return 'allow';
}

export function getSessionRestoreRedirect(pathname: string): '/login' | null {
  return getRouteAccessDecision(pathname, false) === 'login' ? '/login' : null;
}
