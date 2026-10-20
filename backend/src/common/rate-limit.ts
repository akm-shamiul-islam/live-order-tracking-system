import { APP_GUARD, Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import {
  getOptionsToken,
  getStorageToken,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';

export class HttpThrottlerGuard extends ThrottlerGuard {
  override canActivate(context: ExecutionContext): Promise<boolean> {
    // Socket events have no HTTP response object for the rate limit headers.
    return context.getType() === 'http' ? super.canActivate(context) : Promise.resolve(true);
  }
}

// Explicit tokens also work when the development runner omits decorator metadata.
export const httpRateLimiterProvider = {
  provide: APP_GUARD,
  useFactory: (options: ThrottlerModuleOptions, storage: ThrottlerStorage, reflector: Reflector) =>
    new HttpThrottlerGuard(options, storage, reflector),
  inject: [getOptionsToken(), getStorageToken(), Reflector],
};
