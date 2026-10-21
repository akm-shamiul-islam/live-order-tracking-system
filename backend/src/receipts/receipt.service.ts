import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  UserRole,
  type Language,
  type OrderDetails,
  type UserSummary,
} from '@kitchentodoor/shared';
import { getRuntimeSettings } from '../config/runtime-settings.js';
import { OrdersService } from '../orders/orders.service.js';
import { renderOrderReceipt } from './render-order-receipt.js';

@Injectable()
export class ReceiptService {
  constructor(@Inject(OrdersService) private readonly ordersService: OrdersService) {}

  async create(
    identifier: string,
    actor: UserSummary,
    language: Language = actor.language ?? 'en',
  ): Promise<{ orderNumber: string; pdf: Uint8Array }> {
    if (actor.role !== UserRole.CUSTOMER && actor.role !== UserRole.ADMIN)
      throw new ForbiddenException('Insufficient permissions to download this receipt.');

    // This actor-aware lookup enforces customer ownership and deliberately returns 404 for
    // another customer's order so receipt links cannot reveal whether that order exists.
    const order: OrderDetails = await this.ordersService.getOrderById(identifier, actor);
    const pdf = await renderOrderReceipt(order, language, getRuntimeSettings().RECEIPT_TIME_ZONE);
    return { orderNumber: order.orderNumber, pdf };
  }
}
