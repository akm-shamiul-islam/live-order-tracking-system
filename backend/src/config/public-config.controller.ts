import { Controller, Get } from '@nestjs/common';
import type { PublicConfig } from '@kitchentodoor/shared';
import { getPricingSettings, getRuntimeSettings } from './runtime-settings.js';

@Controller('api/config')
export class PublicConfigController {
  @Get()
  getConfig(): PublicConfig {
    return {
      pricing: getPricingSettings(),
      profilePhotoMaxBytes: getRuntimeSettings().PROFILE_PHOTO_MAX_BYTES,
    };
  }
}
