import type { PaymentMethod } from '../cod/cod-contracts';
import type { Order, OrderStatus, Vehicle, VehicleStatus } from './api-contracts';

/**
 * Client-side filtering for the order and fleet lists.
 *
 * Both lists hold one depot's records in memory and refetch on a ten second
 * cycle, so filtering here is faster than a round trip per keystroke and no
 * staler than the list already is. The predicates live outside the components
 * because they are the part worth testing: a missed `?? ''` on a nullable
 * column throws on the first record with no phone number or no driver.
 *
 * Matching is case-insensitive and ignores surrounding whitespace, so a code
 * pasted from a chat message with a trailing space still finds its order.
 */

/** A filter left at its empty string means "no constraint". */
export type OrderFilters = {
  search: string;
  status: OrderStatus | '';
  paymentMethod: PaymentMethod | '';
};

export type VehicleFilters = {
  search: string;
  status: VehicleStatus | '';
  /** `'true'` has a driver, `'false'` unassigned — the select's own values. */
  hasDriver: '' | 'true' | 'false';
};

function matchesSearch(needle: string, fields: ReadonlyArray<string>): boolean {
  if (!needle) {
    return true;
  }
  return fields.some((field) => field.toLowerCase().includes(needle));
}

export function filterOrders(
  orders: ReadonlyArray<Order>,
  filters: OrderFilters,
): Order[] {
  const needle = filters.search.trim().toLowerCase();
  return orders.filter((order) => {
    if (filters.status && order.status !== filters.status) {
      return false;
    }
    if (filters.paymentMethod && order.payment_method !== filters.paymentMethod) {
      return false;
    }
    return matchesSearch(needle, [
      order.order_code,
      order.customer_name,
      order.customer_phone ?? '',
      order.address,
    ]);
  });
}

export function filterVehicles(
  vehicles: ReadonlyArray<Vehicle>,
  filters: VehicleFilters,
): Vehicle[] {
  const needle = filters.search.trim().toLowerCase();
  return vehicles.filter((vehicle) => {
    if (filters.status && vehicle.status !== filters.status) {
      return false;
    }
    if (
      filters.hasDriver
      && String(Boolean(vehicle.driver_name)) !== filters.hasDriver
    ) {
      return false;
    }
    return matchesSearch(needle, [
      vehicle.license_plate,
      vehicle.driver_name ?? '',
      vehicle.vehicle_type,
    ]);
  });
}
