import { describe, expect, it } from 'vitest';

import { isAuthUser, isLoginResult } from './contracts';

describe('auth contracts', () => {
  const user = {
    id: '9fe296c9-c9b0-45d3-9316-202af3b6e6a6',
    email: 'dispatcher@logiroute.vn',
    full_name: 'LogiRoute Dispatcher',
    role: 'DISPATCHER',
    created_at: '2026-07-27T15:18:05.722238Z',
  };

  it('accepts a user returned by FastAPI and rejects unknown roles', () => {
    expect(isAuthUser(user)).toBe(true);
    expect(isAuthUser({ ...user, role: 'SUPER_ADMIN' })).toBe(false);
  });

  it('requires a validated user in the login result', () => {
    expect(isLoginResult({ user })).toBe(true);
    expect(isLoginResult({ access_token: 'must-not-reach-the-browser' })).toBe(false);
  });
});
