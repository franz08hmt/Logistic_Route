import { describe, expect, it } from 'vitest';

import {
  getRouteAccessDecision,
  getSessionRestoreRedirect,
} from './route-access';

describe('route access decisions', () => {
  it.each(['/dashboard', '/orders', '/dispatch', '/drivers', '/fleet', '/analytics', '/map', '/driver', '/admin/users'])(
    'redirects unauthenticated access to %s',
    (pathname) => {
      expect(getRouteAccessDecision(pathname, false)).toBe('login');
    },
  );

  it('redirects an authenticated user away from login', () => {
    expect(getRouteAccessDecision('/login', true)).toBe('dashboard');
    expect(getRouteAccessDecision('/register', true)).toBe('dashboard');
  });

  it('allows matching public and authenticated routes', () => {
    expect(getRouteAccessDecision('/login', false)).toBe('allow');
    expect(getRouteAccessDecision('/register', false)).toBe('allow');
    expect(getRouteAccessDecision('/track/public-token', false)).toBe('allow');
    expect(getRouteAccessDecision('/orders', true)).toBe('allow');
  });

  it('does not redirect public tracking when session restoration is unauthorized', () => {
    expect(getSessionRestoreRedirect('/track/public-token')).toBeNull();
    expect(getSessionRestoreRedirect('/track/nested/token')).toBeNull();
  });

  it('redirects protected pages when session restoration is unauthorized', () => {
    expect(getSessionRestoreRedirect('/orders')).toBe('/login');
    expect(getSessionRestoreRedirect('/admin/users')).toBe('/login');
  });
});
