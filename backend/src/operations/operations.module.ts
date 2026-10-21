import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module.js';
import { OperationsController } from './operations.controller.js';
import { MetricsService, HttpMetricsInterceptor } from './metrics.service.js';

@Module({
  imports: [AuthModule],
  controllers: [OperationsController],
  providers: [MetricsService, { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor }],
})
export class OperationsModule {}
