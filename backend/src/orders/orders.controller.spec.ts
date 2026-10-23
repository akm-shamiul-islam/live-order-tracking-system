import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { OrderStatus } from '@kitchentodoor/shared';
import type { AuthService } from '../auth/auth.service.js';
import type { ReceiptService } from '../receipts/receipt.service.js';
import { OrdersController } from './orders.controller.js';
import type { OrdersGateway } from './orders.gateway.js';
import type { OrdersService } from './orders.service.js';

describe('Order mutation authentication context', () => {
  const orders = {
    updateOrderStatus: vi.fn<OrdersService['updateOrderStatus']>(),
    cancelOrder: vi.fn<OrdersService['cancelOrder']>(),
  };
  let controller: OrdersController;

  beforeEach(() => {
    vi.clearAllMocks();
    // Partial doubles stay at the constructor boundary; rejected calls must not
    // touch persistence or notification dependencies.
    controller = new OrdersController(
      orders as unknown as OrdersService,
      {} as OrdersGateway,
      {} as AuthService,
      {} as ReceiptService,
    );
  });

  it.each([
    {
      name: 'status updates',
      invoke: (target: OrdersController) =>
        target.updateStatus('order', { status: OrderStatus.CONFIRMED }, undefined),
    },
    {
      name: 'cancellation',
      invoke: (target: OrdersController) =>
        target.cancelOrder('order', { reason: 'Customer requested cancellation.' }, undefined),
    },
  ])('rejects $name without an authenticated actor before any write', async ({ invoke }) => {
    await expect(invoke(controller)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(orders.updateOrderStatus).not.toHaveBeenCalled();
    expect(orders.cancelOrder).not.toHaveBeenCalled();
  });
});
