import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { parseRuntimeSettings } from './runtime-settings.js';
import { PublicConfigController } from './public-config.controller.js';

afterEach(() => vi.unstubAllEnvs());

const productionSmtp = {
  SMTP_HOST: 'smtp.example.test',
  SMTP_FROM: 'noreply@example.test',
  SMTP_USER: 'smtp-user',
  SMTP_PASSWORD: 'smtp-password',
};

describe('Validated runtime settings', () => {
  it('derives secure cookies from the validated environment and parses JWT durations as seconds', () => {
    expect(
      parseRuntimeSettings({ NODE_ENV: 'production', ...productionSmtp }).AUTH_COOKIE_SECURE,
    ).toBe(true);
    expect(parseRuntimeSettings({ NODE_ENV: 'development' }).AUTH_COOKIE_SECURE).toBe(false);
    expect(
      parseRuntimeSettings({
        NODE_ENV: 'production',
        AUTH_COOKIE_SECURE: 'false',
        ...productionSmtp,
      }).AUTH_COOKIE_SECURE,
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

  it('uses bounded OTP expiry, resend, attempt, and trusted-device defaults', () => {
    expect(parseRuntimeSettings({})).toMatchObject({
      AUTH_OTP_TTL_SECONDS: 600,
      AUTH_OTP_RESEND_SECONDS: 60,
      AUTH_OTP_MAX_ATTEMPTS: 5,
      AUTH_TRUSTED_DEVICES_MAX: 20,
    });
    expect(() =>
      parseRuntimeSettings({ AUTH_OTP_TTL_SECONDS: '60', AUTH_OTP_RESEND_SECONDS: '60' }),
    ).toThrow('AUTH_OTP_TTL_SECONDS');
    expect(() => parseRuntimeSettings({ NODE_ENV: 'production' })).toThrow('SMTP_HOST');
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
    { PROFILE_PHOTO_MAX_BYTES: '3000001' },
    { PROFILE_PHOTO_MAX_PIXELS: '0' },
    { HTTP_BODY_LIMIT_BYTES: '1000000' },
  ])('rejects invalid settings %j before startup', (settings) => {
    expect(() => parseRuntimeSettings(settings)).toThrow('Invalid environment configuration:');
  });

  it('uses system DNS when the optional override is omitted', () => {
    expect(parseRuntimeSettings({}).DNS_SERVERS).toEqual([]);
  });

  it('exposes only configured public pricing and photo limits without environment secrets', () => {
    vi.stubEnv('DELIVERY_FEE', '7.25');
    vi.stubEnv('TAX_RATE', '0.12');
    vi.stubEnv('JWT_SECRET', 'private-test-secret');
    vi.stubEnv('PROFILE_PHOTO_MAX_BYTES', '1000000');
    expect(new PublicConfigController().getConfig()).toEqual({
      pricing: { deliveryFee: 7.25, taxRate: 0.12 },
      profilePhotoMaxBytes: 1_000_000,
    });
  });
});
