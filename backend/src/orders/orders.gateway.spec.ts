import { describe, expect, it, vi } from 'vitest';
import { OrderStatus } from '@kitchentodoor/shared';
import { OrdersGateway } from './orders.gateway.js';
import type { OrdersService } from './orders.service.js';
import type { AuthService } from '../auth/auth.service.js';
import type { OrderSocket } from '../auth/authenticated-context.js';

describe('OrdersGateway actor requirements', () => {
  const id = '64f1a2b3c4d5e6f7a8b9c0d1';

  it.each(['status', 'location', 'cancel'] as const)(
    'rejects %s writes without an authenticated actor before calling a service',
    async (action) => {
      const orders = {
        updateOrderStatus: vi.fn<OrdersService['updateOrderStatus']>(),
        updateCourierCoordinates: vi.fn<OrdersService['updateCourierCoordinates']>(),
        cancelOrder: vi.fn<OrdersService['cancelOrder']>(),
      };
      // Deliberately call the handler without Nest guards: it must still fail
      // closed. Partial doubles are confined to these constructor boundaries.
      const gateway = new OrdersGateway(orders as unknown as OrdersService, {} as AuthService);
      const client = { data: {} } as OrderSocket;
      const result =
        action === 'status'
          ? await gateway.handleUpdateStatus(client, {
              orderId: id,
              status: OrderStatus.CONFIRMED,
            })
          : action === 'location'
            ? await gateway.handleCourierLocation(client, {
                orderId: id,
                lat: 35.6,
                lng: 139.7,
                timestamp: new Date().toISOString(),
              })
            : await gateway.handleCancelOrder(client, {
                orderId: id,
                reason: 'Customer requested cancellation',
              });

      expect(result).toEqual({ ok: false, error: 'Please sign in again.' });
      expect(orders.updateOrderStatus).not.toHaveBeenCalled();
      expect(orders.updateCourierCoordinates).not.toHaveBeenCalled();
      expect(orders.cancelOrder).not.toHaveBeenCalled();
    },
  );

  it('ignores malformed leave-room payloads', () => {
    const leave = vi.fn<OrderSocket['leave']>();
    const gateway = new OrdersGateway({} as OrdersService, {} as AuthService);
    const client = { id: 'test-client', leave } as unknown as OrderSocket;
    gateway.handleLeaveOrder(client, { orderId: { toString: () => id } });
    expect(leave).not.toHaveBeenCalled();
    gateway.handleLeaveOrder(client, { orderId: id });
    expect(leave).toHaveBeenCalledExactlyOnceWith(`order_${id}`);
  });
});
