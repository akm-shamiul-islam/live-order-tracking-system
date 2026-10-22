import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema.js';
import { Order, OrderSchema } from './schemas/order.schema.js';
import { OrderStatusLog, OrderStatusLogSchema } from './schemas/order-status-log.schema.js';
import { SeedService } from './seed.service.js';
import { AuthSession, AuthSessionSchema } from './schemas/auth-session.schema.js';
import { AccountAccessCoordinator } from '../common/account-access-coordinator.js';
import { ProfileChangeRecord, ProfileChangeRecordSchema } from './schemas/profile-change.schema.js';
import { ProfilePhoto, ProfilePhotoSchema } from './schemas/profile-photo.schema.js';
import { AuthChallenge, AuthChallengeSchema } from './schemas/auth-challenge.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: ProfileChangeRecord.name, schema: ProfileChangeRecordSchema },
      { name: ProfilePhoto.name, schema: ProfilePhotoSchema },
      { name: AuthSession.name, schema: AuthSessionSchema },
      { name: AuthChallenge.name, schema: AuthChallengeSchema },
      { name: Order.name, schema: OrderSchema },
      { name: OrderStatusLog.name, schema: OrderStatusLogSchema },
    ]),
  ],
  providers: [SeedService, AccountAccessCoordinator],
  exports: [MongooseModule, AccountAccessCoordinator],
})
export class DatabaseModule {}
