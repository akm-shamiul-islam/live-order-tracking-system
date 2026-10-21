import { describe, expect, it } from 'vitest';
import { SocketRateLimiter } from './socket-rate-limiter.js';

const settings = () => ({
  SOCKET_RATE_LIMIT_WINDOW_MS: 1000,
  SOCKET_RATE_LIMIT_MAX: 2,
  SOCKET_IP_RATE_LIMIT_MAX: 3,
  SOCKET_RATE_LIMIT_IPS_MAX: 2,
});

describe('Socket packet limits', () => {
  it('limits each connection before its handler executes', () => {
    const limiter = new SocketRateLimiter(settings);
    expect([1, 2, 3].map(() => limiter.consume('peer', 'ip', 0))).toEqual([true, true, false]);
  });
  it('shares the address budget across connections and reconnects', () => {
    const limiter = new SocketRateLimiter(settings);
    expect(limiter.consume('one', 'ip', 0)).toBe(true);
    limiter.disconnect('one');
    expect(limiter.consume('two', 'ip', 0)).toBe(true);
    expect(limiter.consume('three', 'ip', 0)).toBe(true);
    expect(limiter.consume('four', 'ip', 0)).toBe(false);
  });
  it('restores the budget after the configured window', () => {
    const limiter = new SocketRateLimiter(settings);
    for (let i = 0; i < 4; i++) limiter.consume('peer', 'ip', 0);
    expect(limiter.consume('peer', 'ip', 1000)).toBe(true);
  });
  it('bounds address tracking and releases expired entries', () => {
    const limiter = new SocketRateLimiter(settings);
    expect(limiter.consume('one', 'ip-one', 0)).toBe(true);
    expect(limiter.consume('two', 'ip-two', 0)).toBe(true);
    expect(limiter.consume('three', 'ip-three', 0)).toBe(false);
    expect(limiter.consume('three', 'ip-three', 1000)).toBe(true);
  });
});
