import { describe, it, expect } from 'vitest';
import { OrderStatus, type OrderDetails } from '@kitchentodoor/shared';
import { applyOrderStatus, applyCourierLocation, mergeOrderSnapshot } from './orderCache';

const time = (seconds: number) => new Date(Date.UTC(2026, 9, 21, 0, 0, seconds)).toISOString();
const order: OrderDetails = {
  id: 'test-order',
  revision: 4,
  orderNumber: 'KTD-1234',
  status: OrderStatus.OUT_FOR_DELIVERY,
  customer: { name: 'Test Customer', phone: '555-1234', address: 'Test address' },
  courierId: 'assigned-courier',
  items: [],
  deliveryRequests: [],
  pricing: { subtotal: 10, tax: 1, deliveryFee: 5, total: 16 },
  deliveryCoordinates: { lat: 1, lng: 1 },
  deliveryLocationProvided: true,
  courierCoordinates: { lat: 2, lng: 2, lastUpdated: time(20) },
  statusHistory: [],
  createdAt: time(0),
  updatedAt: time(15),
};
const event = (revision: number, status: OrderStatus) => ({
  orderId: order.id,
  orderNumber: order.orderNumber,
  revision,
  status,
  updatedAt: time(revision),
  logEntry: {
    id: `log-${revision}`,
    orderId: order.id,
    orderNumber: order.orderNumber,
    status,
    changedBy: { role: 'ADMIN', name: 'Dispatcher' },
    note: '',
    timestamp: time(revision),
  },
});

describe('Order cache consistency during asynchronous updates', () => {
  it('preserves stable data references when polling returns an unchanged JSON snapshot', () => {
    const snapshot = JSON.parse(JSON.stringify(order)) as OrderDetails;
    expect(mergeOrderSnapshot(order, snapshot)).toBe(order);
  });
  it('does not let a delayed status or cancellation event overwrite a newer terminal state', () => {
    const delivered = applyOrderStatus(order, event(6, OrderStatus.DELIVERED))!;
    expect(applyOrderStatus(delivered, event(5, OrderStatus.PREPARING))).toBe(delivered);
    expect(applyOrderStatus(delivered, event(5, OrderStatus.CANCELLED))).toBe(delivered);
    expect(applyOrderStatus(delivered, event(6, OrderStatus.DELIVERED))).toBe(delivered);
    expect(delivered.statusHistory).toHaveLength(1);
  });

  it('keeps a newer socket state when an older HTTP refetch finishes late', () => {
    const delivered = applyOrderStatus(order, event(6, OrderStatus.DELIVERED))!;
    expect(mergeOrderSnapshot(delivered, { ...order })).toBe(delivered);
  });

  it('rejects stale, duplicate and terminal-order GPS updates', () => {
    const location = { orderId: order.id, lat: 3, lng: 3, timestamp: time(19) };
    expect(applyCourierLocation(order, location)).toBe(order);
    expect(applyCourierLocation(order, { ...location, timestamp: time(20) })).toBe(order);
    const delivered = { ...order, status: OrderStatus.DELIVERED };
    expect(applyCourierLocation(delivered, { ...location, timestamp: time(30) })).toBe(delivered);
    expect(
      applyCourierLocation(order, { ...location, timestamp: time(21) })?.courierCoordinates?.lat,
    ).toBe(3);
  });

  it('keeps the newest location independently of the HTTP snapshot’s state revision', () => {
    const newerState = {
      ...order,
      revision: 5,
      status: OrderStatus.DELIVERED,
      courierCoordinates: { lat: 1, lng: 1, lastUpdated: time(10) },
    };
    const merged = mergeOrderSnapshot(order, newerState);
    expect(merged.status).toBe(OrderStatus.DELIVERED);
    expect(merged.courierCoordinates).toBe(order.courierCoordinates);
  });
});
