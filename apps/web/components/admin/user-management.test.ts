import { describe, expect, it } from 'vitest';

import {
  isAdminUserList,
  nextAccountAction,
} from './user-management';

describe('admin user management contracts', () => {
  const user = {
    id: '9fe296c9-c9b0-45d3-9316-202af3b6e6a6',
    email: 'driver@logiroute.vn',
    full_name: 'Driver',
    phone_number: '0901234567',
    role: 'DRIVER',
    status: 'PENDING_APPROVAL',
    created_at: '2026-07-27T15:18:05.722238Z',
  };

  it('validates a list returned by the Admin users API', () => {
    expect(isAdminUserList([user])).toBe(true);
    expect(isAdminUserList([{ ...user, hashed_password: 'secret' }])).toBe(false);
    expect(isAdminUserList([{ ...user, status: 'UNKNOWN' }])).toBe(false);
  });

  it('maps pending users to approve and active users to suspend', () => {
    expect(nextAccountAction('PENDING_APPROVAL')).toBe('ACTIVE');
    expect(nextAccountAction('ACTIVE')).toBe('SUSPENDED');
    expect(nextAccountAction('SUSPENDED')).toBe('ACTIVE');
  });
});
