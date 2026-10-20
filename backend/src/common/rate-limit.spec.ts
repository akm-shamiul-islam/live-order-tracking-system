import { describe, expect, it } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorageService } from '@nestjs/throttler';
import { HttpThrottlerGuard } from './rate-limit.js';

describe('HTTP rate limiting in the combined HTTP and WebSocket app', () => {
  it('allows socket events to reach their own guards without reading HTTP response headers', async () => {
    const guard = new HttpThrottlerGuard([], new ThrottlerStorageService(), new Reflector());
    const context = {
      getType: () => 'ws',
      switchToHttp: () => {
        throw new Error('Not an HTTP request');
      },
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
