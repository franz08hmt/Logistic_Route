import { isOrderList, type Order } from './api-contracts';

const ORDERS_UPDATED_EVENT = 'logiroute:orders-updated';
const DATA_INVALIDATED_EVENT = 'logiroute:data-invalidated';
const ORDERS_UPDATED_CHANNEL = 'logiroute-orders';

export type DataResource = 'orders' | 'fleet' | 'driver' | 'overview';

type DataInvalidationMessage = {
  type: 'DATA_INVALIDATED';
  resources: DataResource[];
};

function isDataInvalidationMessage(
  value: unknown,
): value is DataInvalidationMessage {
  return (
    typeof value === 'object'
    && value !== null
    && 'type' in value
    && value.type === 'DATA_INVALIDATED'
    && 'resources' in value
    && Array.isArray(value.resources)
  );
}

export function publishOrdersUpdated(orders: Order[]): void {
  window.dispatchEvent(
    new CustomEvent<Order[]>(ORDERS_UPDATED_EVENT, {
      detail: orders,
    }),
  );

  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(ORDERS_UPDATED_CHANNEL);
    channel.postMessage(orders);
    queueMicrotask(() => channel.close());
  }
}

export function publishDataInvalidated(resources: DataResource[]): void {
  const message: DataInvalidationMessage = {
    type: 'DATA_INVALIDATED',
    resources: [...new Set(resources)],
  };
  window.dispatchEvent(
    new CustomEvent<DataInvalidationMessage>(DATA_INVALIDATED_EVENT, {
      detail: message,
    }),
  );

  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(ORDERS_UPDATED_CHANNEL);
    channel.postMessage(message);
    queueMicrotask(() => channel.close());
  }
}

export function subscribeToDataInvalidated(
  resources: DataResource[],
  listener: () => void,
): () => void {
  const resourceSet = new Set(resources);
  const shouldRefresh = (message: DataInvalidationMessage) =>
    message.resources.some((resource) => resourceSet.has(resource));
  const handleInvalidation = (event: Event) => {
    const message = (event as CustomEvent<unknown>).detail;
    if (isDataInvalidationMessage(message) && shouldRefresh(message)) {
      listener();
    }
  };
  const channel =
    'BroadcastChannel' in window
      ? new BroadcastChannel(ORDERS_UPDATED_CHANNEL)
      : null;

  if (channel) {
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (isDataInvalidationMessage(event.data) && shouldRefresh(event.data)) {
        listener();
      }
    };
  }

  window.addEventListener(DATA_INVALIDATED_EVENT, handleInvalidation);
  return () => {
    window.removeEventListener(DATA_INVALIDATED_EVENT, handleInvalidation);
    channel?.close();
  };
}

export function subscribeToOrdersUpdated(
  listener: (orders: Order[]) => void,
): () => void {
  const handleOrdersUpdated = (event: Event) => {
    const orders = (event as CustomEvent<unknown>).detail;
    if (isOrderList(orders)) {
      listener(orders);
    }
  };
  const channel =
    'BroadcastChannel' in window
      ? new BroadcastChannel(ORDERS_UPDATED_CHANNEL)
      : null;

  if (channel) {
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (isOrderList(event.data)) {
        listener(event.data);
      }
    };
  }

  window.addEventListener(ORDERS_UPDATED_EVENT, handleOrdersUpdated);
  return () => {
    window.removeEventListener(ORDERS_UPDATED_EVENT, handleOrdersUpdated);
    channel?.close();
  };
}
