import { isOrderList, type Order } from './api-contracts';

const ORDERS_UPDATED_EVENT = 'logiroute:orders-updated';
const ORDERS_UPDATED_CHANNEL = 'logiroute-orders';

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
