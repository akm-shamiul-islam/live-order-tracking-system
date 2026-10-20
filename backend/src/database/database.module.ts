import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema.js';
import { Order, OrderSchema } from './schemas/order.schema.js';
import { OrderStatusLog, OrderStatusLogSchema } from './schemas/order-status-log.schema.js';
import { SeedService } from './seed.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Order.name, schema: OrderSchema },
      { name: OrderStatusLog.name, schema: OrderStatusLogSchema },
    ]),
  ],
  providers: [SeedService],
  exports: [MongooseModule],
})
export class DatabaseModule {}
