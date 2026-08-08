export const ORDER_ACTIVITY_ACTIONS = [
  'CREATED',
  'STATUS_CHANGED',
  'ASSIGNED',
  'POD_UPLOADED',
  'SIGNATURE_UPLOADED',
  'IMPORTED',
] as const;

export type OrderActivityAction = (typeof ORDER_ACTIVITY_ACTIONS)[number];

export type OrderActivity = {
  id: string;
  action: OrderActivityAction;
  old_status: string | null;
  new_status: string | null;
  actor_name: string | null;
  actor_role: string | null;
  detail: string | null;
  created_at: string;
};

export type OrderActivityList = {
  order_id: string;
  order_code: string;
  activities: OrderActivity[];
};

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}

function isOrderActivity(value: unknown): value is OrderActivity {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const activity = value as Record<string, unknown>;
  return (
    typeof activity.id === 'string'
    && ORDER_ACTIVITY_ACTIONS.includes(
      activity.action as OrderActivityAction,
    )
    && isNullableString(activity.old_status)
    && isNullableString(activity.new_status)
    && isNullableString(activity.actor_name)
    && isNullableString(activity.actor_role)
    && isNullableString(activity.detail)
    && typeof activity.created_at === 'string'
    && !Number.isNaN(Date.parse(activity.created_at))
  );
}

export function isOrderActivityList(
  value: unknown,
): value is OrderActivityList {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const response = value as Record<string, unknown>;
  return (
    typeof response.order_id === 'string'
    && typeof response.order_code === 'string'
    && Array.isArray(response.activities)
    && response.activities.every(isOrderActivity)
  );
}
