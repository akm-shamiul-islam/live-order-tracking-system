import { z } from 'zod';
import { isIP } from 'node:net';

const positiveInteger = (value: number) => z.coerce.number().int().positive().default(value);
const tokenLifetime = z
  .string()
  .regex(/^[1-9]\d*(?:s|m|h|d|w)?$/, 'Use seconds or a duration such as 15m, 1h, or 7d')
  .default('15m')
  .transform((value) => {
    const unit = value.slice(-1);
    const seconds = /\d/.test(unit)
      ? Number(value)
      : Number(value.slice(0, -1)) * ({ s: 1, m: 60, h: 3600, d: 86400, w: 604800 }[unit] ?? 1);
    return seconds;
  })
  .pipe(z.number().int().positive().max(31_536_000));

export const RuntimeSettingsSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: positiveInteger(5000).pipe(z.number().max(65535)),
    API_HOST: z.string().trim().min(1).default('0.0.0.0'),
    TRUSTED_PROXY_IPS: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean),
      )
      .refine(
        (entries) => entries.every((entry) => isIP(entry) !== 0),
        'Use exact comma-separated proxy IP addresses',
      ),
    RATE_LIMIT_TTL_MS: positiveInteger(60_000),
    RATE_LIMIT_MAX: positiveInteger(120),
    LOGIN_RATE_LIMIT_TTL_MS: positiveInteger(60_000),
    LOGIN_RATE_LIMIT_MAX: positiveInteger(10),
    REGISTER_RATE_LIMIT_TTL_MS: positiveInteger(60_000),
    REGISTER_RATE_LIMIT_MAX: positiveInteger(5),
    REFRESH_RATE_LIMIT_MAX: positiveInteger(30),
    RESET_RATE_LIMIT_MAX: positiveInteger(5),
    OTP_REQUEST_RATE_LIMIT_MAX: positiveInteger(5),
    OTP_VERIFY_RATE_LIMIT_MAX: positiveInteger(10),
    RECEIPT_RATE_LIMIT_MAX: positiveInteger(10),
    RECEIPT_TIME_ZONE: z
      .string()
      .trim()
      .min(1)
      .default('UTC')
      .refine((timeZone) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone });
          return true;
        } catch {
          return false;
        }
      }, 'Use a valid IANA time zone'),
    AUTH_SESSION_TTL_MS: positiveInteger(604_800_000),
    AUTH_OTP_TTL_SECONDS: positiveInteger(600).pipe(z.number().max(3600)),
    AUTH_OTP_RESEND_SECONDS: positiveInteger(60).pipe(z.number().max(86_400)),
    AUTH_OTP_MAX_ATTEMPTS: positiveInteger(5).pipe(z.number().max(20)),
    AUTH_TRUSTED_DEVICES_MAX: positiveInteger(20).pipe(z.number().max(100)),
    JWT_EXPIRES_IN: tokenLifetime,
    AUTH_REFRESH_HISTORY_MAX: positiveInteger(1000),
    AUTH_COOKIE_SECURE: z.stringbool().optional(),
    PUBLIC_APP_URL: z.url().default('http://localhost:5173'),
    SMTP_HOST: z.string().trim().optional(),
    SMTP_PORT: positiveInteger(587),
    SMTP_SECURE: z.stringbool().default(false),
    SMTP_REQUIRE_TLS: z.stringbool().default(true),
    SMTP_CONNECTION_TIMEOUT_MS: positiveInteger(10_000),
    SMTP_SOCKET_TIMEOUT_MS: positiveInteger(15_000),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_FROM: z.email().optional(),
    SMTP_FROM_NAME: z.string().trim().min(1).max(100).default('KitchenToDoor'),
    PASSWORD_HASH_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
    ORDER_LIST_DEFAULT_LIMIT: positiveInteger(50),
    ORDER_LIST_MAX_LIMIT: positiveInteger(100),
    ORDER_HISTORY_LIMIT: positiveInteger(20),
    ORDER_ESTIMATE_MINUTES: positiveInteger(35),
    KITCHEN_LATITUDE: z.coerce.number().min(-90).max(90).default(40.7128),
    KITCHEN_LONGITUDE: z.coerce.number().min(-180).max(180).default(-74.006),
    ORDER_NUMBER_RETRY_ATTEMPTS: positiveInteger(5),
    DELIVERY_REQUESTS_MAX: positiveInteger(100),
    USER_LIST_DEFAULT_LIMIT: positiveInteger(10),
    USER_LIST_MAX_LIMIT: positiveInteger(100),
    USER_MANAGEMENT_AUDIT_MAX: positiveInteger(100),
    PROFILE_CHANGE_RATE_LIMIT_MAX: positiveInteger(5),
    PROFILE_PHOTO_MAX_BYTES: positiveInteger(2_000_000).pipe(z.number().max(3_000_000)),
    PROFILE_PHOTO_MAX_PIXELS: positiveInteger(20_000_000),
    PROFILE_PHOTO_SIZE: positiveInteger(256).pipe(z.number().max(1024)),
    PROFILE_RECOVERY_INTERVAL_MS: positiveInteger(15_000),
    PROFILE_RECOVERY_BATCH_SIZE: positiveInteger(50),
    HTTP_BODY_LIMIT_BYTES: positiveInteger(4_100_000),
    TELEMETRY_MAX_AGE_MS: positiveInteger(15_000),
    TELEMETRY_MAX_FUTURE_MS: positiveInteger(5000),
    SOCKET_RATE_LIMIT_WINDOW_MS: positiveInteger(1000),
    SOCKET_RATE_LIMIT_MAX: positiveInteger(50),
    SOCKET_IP_RATE_LIMIT_MAX: positiveInteger(200),
    SOCKET_RATE_LIMIT_IPS_MAX: positiveInteger(10_000),
    SOCKET_ORDER_ROOMS_MAX: positiveInteger(20),
    SOCKET_MAX_PAYLOAD_BYTES: positiveInteger(16_384),
    SOCKET_CONNECT_WINDOW_MS: positiveInteger(60_000),
    SOCKET_CONNECT_MAX: positiveInteger(30),
    SOCKET_CONNECTIONS_MAX: positiveInteger(2000),
    SOCKET_CONNECTIONS_PER_IP_MAX: positiveInteger(20),
    DELIVERY_FEE: z.coerce.number().min(0).default(5),
    TAX_RATE: z.coerce.number().min(0).max(1).default(0.08),
    MONGODB_SERVER_SELECTION_TIMEOUT_MS: positiveInteger(5000),
    MONGODB_RETRY_ATTEMPTS: z.coerce.number().int().min(0).default(1),
    MONGODB_RETRY_DELAY_MS: positiveInteger(3000),
    MONGODB_HEARTBEAT_FREQUENCY_MS: positiveInteger(10_000).pipe(z.number().min(500)),
    MONGODB_MAX_POOL_SIZE: positiveInteger(100),
    MONGODB_SOCKET_TIMEOUT_MS: positiveInteger(10_000),
    MONGODB_WAIT_QUEUE_TIMEOUT_MS: positiveInteger(5000),
    MONGODB_WRITE_TIMEOUT_MS: positiveInteger(5000),
    HEALTHCHECK_TIMEOUT_MS: positiveInteger(1000),
    SERVE_FRONTEND: z.stringbool().default(false),
    STATIC_ASSET_MAX_AGE_SECONDS: positiveInteger(3600),
    STATIC_HASHED_MAX_AGE_SECONDS: positiveInteger(31_536_000),
    DNS_SERVERS: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean),
      )
      .refine(
        (servers) => servers.every((server) => isIP(server) !== 0),
        'Use comma-separated IPv4 or IPv6 DNS server addresses',
      ),
  })
  .superRefine((settings, context) => {
    if (
      settings.HTTP_BODY_LIMIT_BYTES <
      Math.ceil(settings.PROFILE_PHOTO_MAX_BYTES / 3) * 4 + 65_536
    )
      context.addIssue({
        code: 'custom',
        path: ['HTTP_BODY_LIMIT_BYTES'],
        message: 'Allow enough request bytes for the configured profile photo and JSON fields',
      });
    if (settings.USER_LIST_DEFAULT_LIMIT > settings.USER_LIST_MAX_LIMIT) {
      context.addIssue({
        code: 'custom',
        path: ['USER_LIST_DEFAULT_LIMIT'],
        message: 'Default user limit must not exceed USER_LIST_MAX_LIMIT',
      });
    }
    if (settings.AUTH_OTP_TTL_SECONDS <= settings.AUTH_OTP_RESEND_SECONDS) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_OTP_TTL_SECONDS'],
        message: 'The OTP lifetime must be longer than its resend cooldown',
      });
    }
    if (Boolean(settings.SMTP_USER) !== Boolean(settings.SMTP_PASSWORD)) {
      context.addIssue({
        code: 'custom',
        path: ['SMTP_USER'],
        message: 'SMTP_USER and SMTP_PASSWORD must be configured together',
      });
    }
    const hasSmtpSettings = Boolean(
      settings.SMTP_HOST || settings.SMTP_FROM || settings.SMTP_USER || settings.SMTP_PASSWORD,
    );
    if (
      hasSmtpSettings &&
      (!settings.SMTP_HOST || !settings.SMTP_FROM || !settings.SMTP_USER || !settings.SMTP_PASSWORD)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['SMTP_HOST'],
        message: 'Configure SMTP_HOST, SMTP_FROM, SMTP_USER and SMTP_PASSWORD together',
      });
    }
    if (
      settings.NODE_ENV === 'production' &&
      (!settings.SMTP_HOST || !settings.SMTP_FROM || !settings.SMTP_USER || !settings.SMTP_PASSWORD)
    )
      context.addIssue({
        code: 'custom',
        path: ['SMTP_HOST'],
        message: 'Production requires an authenticated SMTP transport for account verification',
      });
    if (settings.ORDER_LIST_DEFAULT_LIMIT > settings.ORDER_LIST_MAX_LIMIT) {
      context.addIssue({
        code: 'custom',
        path: ['ORDER_LIST_DEFAULT_LIMIT'],
        message: 'Default order limit must not exceed ORDER_LIST_MAX_LIMIT',
      });
    }
  })
  .transform((settings) => ({
    ...settings,
    AUTH_COOKIE_SECURE: settings.AUTH_COOKIE_SECURE ?? settings.NODE_ENV === 'production',
  }));

export type RuntimeSettings = z.infer<typeof RuntimeSettingsSchema>;
let configuredSettings: RuntimeSettings | undefined;

export function parseRuntimeSettings(environment: Record<string, unknown>): RuntimeSettings {
  const parsed = RuntimeSettingsSchema.safeParse(environment);
  if (!parsed.success) {
    throw new Error(
      'Invalid environment configuration: ' +
        parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
    );
  }
  return parsed.data;
}

export function validateEnvironment(environment: Record<string, unknown>) {
  configuredSettings = parseRuntimeSettings(environment);
  return { ...environment, ...configuredSettings };
}

export function getRuntimeSettings(): RuntimeSettings {
  return configuredSettings ?? parseRuntimeSettings(process.env);
}

export function getPricingSettings() {
  const settings = getRuntimeSettings();
  return { deliveryFee: settings.DELIVERY_FEE, taxRate: settings.TAX_RATE };
}
