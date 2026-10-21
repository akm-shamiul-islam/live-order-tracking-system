import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { parseRuntimeSettings } from './runtime-settings.js';
import { PublicConfigController } from './public-config.controller.js';

afterEach(() => vi.unstubAllEnvs());

describe('Validated runtime settings', () => {
  it('derives secure cookies from the validated environment and parses JWT durations as seconds', () => {
    expect(parseRuntimeSettings({ NODE_ENV: 'production' }).AUTH_COOKIE_SECURE).toBe(true);
    expect(parseRuntimeSettings({ NODE_ENV: 'development' }).AUTH_COOKIE_SECURE).toBe(false);
    expect(
      parseRuntimeSettings({ NODE_ENV: 'production', AUTH_COOKIE_SECURE: 'false' })
        .AUTH_COOKIE_SECURE,
    ).toBe(false);
    expect(parseRuntimeSettings({ JWT_EXPIRES_IN: '15m' }).JWT_EXPIRES_IN).toBe(900);
    expect(parseRuntimeSettings({ JWT_EXPIRES_IN: '120' }).JWT_EXPIRES_IN).toBe(120);
    expect(() => parseRuntimeSettings({ JWT_EXPIRES_IN: 'not-a-duration' })).toThrow(
      'JWT_EXPIRES_IN',
    );
  });
  it('accepts the actual environment template and preserves operational defaults', () => {
    const example = parse(readFileSync(new URL('../../../.env.example', import.meta.url)));
    expect(parseRuntimeSettings(example)).toMatchObject({
      RATE_LIMIT_MAX: 120,
      LOGIN_RATE_LIMIT_MAX: 10,
      REGISTER_RATE_LIMIT_MAX: 5,
      PASSWORD_HASH_ROUNDS: 12,
      DELIVERY_FEE: 5,
      TAX_RATE: 0.08,
    });
  });

  it('coerces custom rate windows, pricing, and query settings', () => {
    expect(
      parseRuntimeSettings({
        LOGIN_RATE_LIMIT_MAX: '3',
        LOGIN_RATE_LIMIT_TTL_MS: '180000',
        DELIVERY_FEE: '7.25',
        TAX_RATE: '0.12',
        ORDER_LIST_DEFAULT_LIMIT: '10',
        ORDER_LIST_MAX_LIMIT: '25',
      }),
    ).toMatchObject({
      LOGIN_RATE_LIMIT_MAX: 3,
      LOGIN_RATE_LIMIT_TTL_MS: 180000,
      DELIVERY_FEE: 7.25,
      TAX_RATE: 0.12,
      ORDER_LIST_DEFAULT_LIMIT: 10,
      ORDER_LIST_MAX_LIMIT: 25,
    });
  });

  it.each([
    { RATE_LIMIT_MAX: '0' },
    { LOGIN_RATE_LIMIT_TTL_MS: '-1' },
    { REGISTER_RATE_LIMIT_MAX: 'not-a-number' },
    { PASSWORD_HASH_ROUNDS: '3' },
    { TAX_RATE: '2' },
    { DELIVERY_FEE: '-1' },
    { DELIVERY_FEE: 'Infinity' },
    { DELIVERY_FEE: 'NaN' },
    { PORT: '70000' },
    { ORDER_LIST_DEFAULT_LIMIT: '50', ORDER_LIST_MAX_LIMIT: '10' },
    { DNS_SERVERS: 'not-an-ip' },
  ])('rejects invalid settings %j before startup', (settings) => {
    expect(() => parseRuntimeSettings(settings)).toThrow('Invalid environment configuration:');
  });

  it('uses system DNS when the optional override is omitted', () => {
    expect(parseRuntimeSettings({}).DNS_SERVERS).toEqual([]);
  });

  it('exposes only configured public pricing without environment secrets', () => {
    vi.stubEnv('DELIVERY_FEE', '7.25');
    vi.stubEnv('TAX_RATE', '0.12');
    vi.stubEnv('JWT_SECRET', 'private-test-secret');
    expect(new PublicConfigController().getConfig()).toEqual({
      pricing: { deliveryFee: 7.25, taxRate: 0.12 },
    });
  });
});
