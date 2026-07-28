const protectedRoutePrefixes = ['/dashboard', '/orders', '/fleet', '/map', '/driver'];

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

  if (pathname === '/login' && hasSession) {
    return 'dashboard';
  }

  return 'allow';
}
