import { describe, expect, it } from 'vitest';

import { getRouteAccessDecision } from './route-access';

describe('route access decisions', () => {
  it.each(['/dashboard', '/orders', '/fleet', '/map'])(
    'redirects unauthenticated access to %s',
    (pathname) => {
      expect(getRouteAccessDecision(pathname, false)).toBe('login');
    },
  );

  it('redirects an authenticated user away from login', () => {
    expect(getRouteAccessDecision('/login', true)).toBe('dashboard');
  });

  it('allows matching public and authenticated routes', () => {
    expect(getRouteAccessDecision('/login', false)).toBe('allow');
    expect(getRouteAccessDecision('/orders', true)).toBe('allow');
  });
});
