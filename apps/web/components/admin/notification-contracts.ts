import { type OrderStatus, requestApi } from './api-contracts';

export const NOTIFICATION_CHANNELS = ['ZALO_ZNS', 'SMS_BRANDNAME'] as const;
export const NOTIFICATION_STATUSES = ['SENT', 'DELIVERED', 'FAILED'] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export type CustomerNotification = {
  id: string;
  order_id: string;
  recipient_phone: string;
  channel: NotificationChannel;
  template_code: string;
  title: string;
  message_content: string;
  tracking_url: string | null;
  status: NotificationStatus;
  sent_at: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isCustomerNotification(value: unknown): value is CustomerNotification {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string'
    && typeof value.order_id === 'string'
    && typeof value.recipient_phone === 'string'
    && NOTIFICATION_CHANNELS.includes(value.channel as NotificationChannel)
    && typeof value.template_code === 'string'
    && typeof value.title === 'string'
    && typeof value.message_content === 'string'
    && (typeof value.tracking_url === 'string' || value.tracking_url === null)
    && NOTIFICATION_STATUSES.includes(value.status as NotificationStatus)
    && typeof value.sent_at === 'string'
    && !Number.isNaN(Date.parse(value.sent_at))
  );
}

export function isCustomerNotificationList(
  value: unknown,
): value is CustomerNotification[] {
  return Array.isArray(value) && value.every(isCustomerNotification);
}

export function notificationTemplateForStatus(status: OrderStatus): string | null {
  return {
    ASSIGNED: 'ORDER_ASSIGNED',
    DELIVERING: 'ORDER_OUT_FOR_DELIVERY',
    DELIVERED: 'ORDER_DELIVERED',
    FAILED: 'ORDER_FAILED',
    PENDING: null,
  }[status];
}

export async function fetchOrderNotifications(
  orderId: string,
  signal?: AbortSignal,
): Promise<CustomerNotification[]> {
  const payload = await requestApi(`/api/v1/orders/${orderId}/notifications`, { signal });
  if (!isCustomerNotificationList(payload)) {
    throw new Error('Invalid customer notification response');
  }
  return payload;
}

export async function resendOrderNotification(
  orderId: string,
  channel: NotificationChannel,
): Promise<CustomerNotification> {
  const payload = await requestApi(`/api/v1/orders/${orderId}/notifications/resend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel }),
  });
  if (!isCustomerNotification(payload)) {
    throw new Error('Invalid customer notification response');
  }
  return payload;
}
