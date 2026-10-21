import {
  Controller,
  Get,
  Inject,
  UseGuards,
  ServiceUnavailableException,
  Header,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { STATES, type Connection } from 'mongoose';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '@kitchentodoor/shared';
import { MetricsService } from './metrics.service.js';
import { getRuntimeSettings } from '../config/runtime-settings.js';

@Controller('api')
export class OperationsController {
  constructor(
    @InjectConnection() private readonly database: Connection,
    @Inject(MetricsService) private readonly metrics: MetricsService,
  ) {}

  @Get('health/live')
  @Header('Cache-Control', 'no-store')
  live() {
    return { status: 'ok' };
  }

  @Get('health/ready')
  @Header('Cache-Control', 'no-store')
  async ready() {
    try {
      if (this.database.readyState !== STATES.connected || !this.database.db)
        throw new Error('Database is unavailable');
      await this.database.db
        .admin()
        .command({ ping: 1 }, { timeoutMS: getRuntimeSettings().HEALTHCHECK_TIMEOUT_MS });
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException('The order service is temporarily unavailable.');
    }
  }

  @Get('ops/metrics')
  @Header('Cache-Control', 'no-store')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  statistics() {
    return this.metrics.snapshot();
  }
}
