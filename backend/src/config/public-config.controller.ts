import { Controller, Get } from '@nestjs/common';
import type { PublicConfig } from '@kitchentodoor/shared';
import { getPricingSettings } from './runtime-settings.js';

@Controller('api/config')
export class PublicConfigController {
  @Get()
  getConfig(): PublicConfig {
    // Explicitly expose public pricing only, never environment variables or secrets.
    return { pricing: getPricingSettings() };
  }
}
