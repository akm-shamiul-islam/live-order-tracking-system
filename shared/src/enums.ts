export const OrderStatus = {
  PLACED: 'PLACED',
  CONFIRMED: 'CONFIRMED',
  PREPARING: 'PREPARING',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const ORDER_STATUS_SEQUENCE: OrderStatus[] = [
  OrderStatus.PLACED,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
];

export const UserRole = {
  CUSTOMER: 'CUSTOMER',
  COURIER: 'COURIER',
  ADMIN: 'ADMIN',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/**
 * Validates whether a state transition from `currentStatus` to `nextStatus` is allowed.
 */
export function isValidStatusTransition(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
): boolean {
  if (currentStatus === nextStatus) return false;
  if (currentStatus === OrderStatus.DELIVERED || currentStatus === OrderStatus.CANCELLED) {
    return false;
  }
  if (nextStatus === OrderStatus.CANCELLED) {
    return (
      currentStatus === OrderStatus.PLACED ||
      currentStatus === OrderStatus.CONFIRMED ||
      currentStatus === OrderStatus.PREPARING
    );
  }

  const currentIndex = ORDER_STATUS_SEQUENCE.indexOf(currentStatus);
  const nextIndex = ORDER_STATUS_SEQUENCE.indexOf(nextStatus);

  if (currentIndex === -1 || nextIndex === -1) return false;
  // Strictly sequential forward progression
  return nextIndex === currentIndex + 1;
}

export function getStatusStepIndex(status: OrderStatus): number {
  return ORDER_STATUS_SEQUENCE.indexOf(status);
}
