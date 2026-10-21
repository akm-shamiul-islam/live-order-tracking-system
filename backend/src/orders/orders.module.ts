import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { OrdersService } from './orders.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersGateway } from './orders.gateway.js';
import { ReceiptService } from '../receipts/receipt.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  providers: [OrdersService, OrdersGateway, ReceiptService],
  controllers: [OrdersController],
  exports: [OrdersService, OrdersGateway],
})
export class OrdersModule {}
