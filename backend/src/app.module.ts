import { Module } from '@nestjs/common';
import { fileURLToPath } from 'node:url';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { httpRateLimiterProvider } from './common/rate-limit.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { getRuntimeSettings, validateEnvironment } from './config/runtime-settings.js';
import { PublicConfigController } from './config/public-config.controller.js';
import { OperationsModule } from './operations/operations.module.js';
import { UsersModule } from './users/users.module.js';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseExceptionFilter } from './common/database-exception.filter.js';
import { ApiResponseInterceptor } from './common/api-response.interceptor.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
      // The root configuration takes precedence regardless of the command's cwd.
      envFilePath: [
        fileURLToPath(new URL('../../.env', import.meta.url)),
        fileURLToPath(new URL('../.env', import.meta.url)),
      ],
    }),
    MongooseModule.forRootAsync({
      useFactory: () => {
        const settings = getRuntimeSettings();
        return {
          uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/kitchentodoor_db',
          serverSelectionTimeoutMS: settings.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
          retryAttempts: settings.MONGODB_RETRY_ATTEMPTS,
          retryDelay: settings.MONGODB_RETRY_DELAY_MS,
          heartbeatFrequencyMS: settings.MONGODB_HEARTBEAT_FREQUENCY_MS,
          maxPoolSize: settings.MONGODB_MAX_POOL_SIZE,
          socketTimeoutMS: settings.MONGODB_SOCKET_TIMEOUT_MS,
          waitQueueTimeoutMS: settings.MONGODB_WAIT_QUEUE_TIMEOUT_MS,
          bufferCommands: false,
          writeConcern: {
            w: 'majority',
            journal: true,
            wtimeoutMS: settings.MONGODB_WRITE_TIMEOUT_MS,
          },
        };
      },
    }),
    ThrottlerModule.forRootAsync({
      useFactory: () => [
        { ttl: getRuntimeSettings().RATE_LIMIT_TTL_MS, limit: getRuntimeSettings().RATE_LIMIT_MAX },
      ],
    }),
    DatabaseModule,
    AuthModule,
    OrdersModule,
    UsersModule,
    OperationsModule,
  ],
  providers: [
    httpRateLimiterProvider,
    { provide: APP_FILTER, useClass: DatabaseExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor },
  ],
  controllers: [PublicConfigController],
})
export class AppModule {}
