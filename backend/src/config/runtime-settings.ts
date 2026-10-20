import { z } from 'zod';
import { isIP } from 'node:net';

const positiveInteger = (value: number) => z.coerce.number().int().positive().default(value);

export const RuntimeSettingsSchema = z
  .object({
    PORT: positiveInteger(5000).pipe(z.number().max(65535)),
    API_HOST: z.string().trim().min(1).default('0.0.0.0'),
    RATE_LIMIT_TTL_MS: positiveInteger(60_000),
    RATE_LIMIT_MAX: positiveInteger(120),
    LOGIN_RATE_LIMIT_TTL_MS: positiveInteger(60_000),
    LOGIN_RATE_LIMIT_MAX: positiveInteger(10),
    REGISTER_RATE_LIMIT_TTL_MS: positiveInteger(60_000),
    REGISTER_RATE_LIMIT_MAX: positiveInteger(5),
    PASSWORD_HASH_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
    ORDER_LIST_DEFAULT_LIMIT: positiveInteger(50),
    ORDER_LIST_MAX_LIMIT: positiveInteger(100),
    ORDER_HISTORY_LIMIT: positiveInteger(20),
    ORDER_ESTIMATE_MINUTES: positiveInteger(35),
    DELIVERY_FEE: z.coerce.number().min(0).default(5),
    TAX_RATE: z.coerce.number().min(0).max(1).default(0.08),
    MONGODB_SERVER_SELECTION_TIMEOUT_MS: positiveInteger(30_000),
    MONGODB_RETRY_ATTEMPTS: z.coerce.number().int().min(0).default(9),
    MONGODB_RETRY_DELAY_MS: positiveInteger(3000),
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
    if (settings.ORDER_LIST_DEFAULT_LIMIT > settings.ORDER_LIST_MAX_LIMIT) {
      context.addIssue({
        code: 'custom',
        path: ['ORDER_LIST_DEFAULT_LIMIT'],
        message: 'Default order limit must not exceed ORDER_LIST_MAX_LIMIT',
      });
    }
  });

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
