import { describe, expect, it } from 'vitest';

import {
  isCustomerNotification,
  isCustomerNotificationList,
  notificationTemplateForStatus,
} from './notification-contracts';

const notification = {
  id: '0ad58d21-4cb5-43be-92b1-d07f63af18bf',
  order_id: '5e5d2566-5979-4497-a50d-f8ea97b8fe52',
  recipient_phone: '0901234567',
  channel: 'ZALO_ZNS',
  template_code: 'ORDER_ASSIGNED',
  title: '[LogiRoute VN] Don hang da san sang van chuyen',
  message_content: 'Noi dung thong bao',
  tracking_url: 'http://localhost:3001/track/example-token',
  status: 'SENT',
  sent_at: '2026-08-07T10:30:00Z',
};

describe('customer notification contracts', () => {
  it('accepts documented notification responses', () => {
    expect(isCustomerNotification(notification)).toBe(true);
    expect(isCustomerNotificationList([notification])).toBe(true);
  });

  it('rejects unknown channels, statuses, and malformed timestamps', () => {
    expect(isCustomerNotification({ ...notification, channel: 'EMAIL' })).toBe(false);
    expect(isCustomerNotification({ ...notification, status: 'QUEUED' })).toBe(false);
    expect(isCustomerNotification({ ...notification, sent_at: 'yesterday' })).toBe(false);
  });

  it('maps operational order statuses to resend templates', () => {
    expect(notificationTemplateForStatus('ASSIGNED')).toBe('ORDER_ASSIGNED');
    expect(notificationTemplateForStatus('DELIVERING')).toBe('ORDER_OUT_FOR_DELIVERY');
    expect(notificationTemplateForStatus('DELIVERED')).toBe('ORDER_DELIVERED');
    expect(notificationTemplateForStatus('FAILED')).toBe('ORDER_FAILED');
    expect(notificationTemplateForStatus('PENDING')).toBeNull();
  });
});
