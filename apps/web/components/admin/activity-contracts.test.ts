import { describe, expect, it } from 'vitest';

import { isOrderActivityList } from './activity-contracts';

describe('order activity response contract', () => {
  const response = {
    order_id: '9f6c17d4-4835-4a67-b7a3-e60a5d46f568',
    order_code: 'LR-ACTIVITY-001',
    activities: [
      {
        id: 'c54333a0-7a80-49ad-9733-b9d78b647573',
        action: 'STATUS_CHANGED',
        old_status: 'ASSIGNED',
        new_status: 'DELIVERED',
        actor_name: 'Tai Huynh',
        actor_role: 'DRIVER',
        detail: 'POD confirmed',
        created_at: '2026-07-31T08:20:00Z',
      },
    ],
  };

  it('accepts the documented activity list response', () => {
    expect(isOrderActivityList(response)).toBe(true);
  });

  it('rejects unknown actions and malformed timestamps', () => {
    expect(isOrderActivityList({
      ...response,
      activities: [{ ...response.activities[0], action: 'DELETED' }],
    })).toBe(false);
    expect(isOrderActivityList({
      ...response,
      activities: [{ ...response.activities[0], created_at: 'not-a-date' }],
    })).toBe(false);
  });

  it('accepts nullable actor and transition metadata', () => {
    expect(isOrderActivityList({
      ...response,
      activities: [{
        ...response.activities[0],
        action: 'CREATED',
        old_status: null,
        actor_name: null,
        actor_role: null,
        detail: null,
      }],
    })).toBe(true);
  });

  it('accepts recipient signature upload audit events', () => {
    expect(isOrderActivityList({
      ...response,
      activities: [{
        ...response.activities[0],
        action: 'SIGNATURE_UPLOADED',
        old_status: null,
        new_status: null,
        detail: 'Recipient signature uploaded for Nguyen Van A',
      }],
    })).toBe(true);
  });
});
