/**
 * Background polling replaces an order object even when the dispatcher is
 * still viewing the same order. Only a real order change should dismiss a
 * nested preview such as the printable delivery bill.
 */
export function shouldResetOrderDetailOverlays(
  previousOrderId: string | null,
  nextOrderId: string | null,
): boolean {
  return nextOrderId !== null && previousOrderId !== nextOrderId;
}
