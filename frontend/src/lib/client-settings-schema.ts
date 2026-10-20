import { z } from 'zod';

const positiveInteger = (value: number) => z.coerce.number().int().positive().default(value);
export const FrontendPortSchema = positiveInteger(5173).pipe(z.number().max(65535));
export const ClientSettingsSchema = z.object({
  VITE_REQUEST_TIMEOUT_MS: positiveInteger(15_000),
  VITE_QUERY_STALE_TIME_MS: z.coerce.number().int().min(0).default(30_000),
  VITE_QUERY_RETRY_COUNT: z.coerce.number().int().min(0).default(1),
  VITE_SESSION_STALE_TIME_MS: z.coerce.number().int().min(0).default(60_000),
  VITE_SOCKET_ACK_TIMEOUT_MS: positiveInteger(5000),
  VITE_SOCKET_RECONNECT_ATTEMPTS: positiveInteger(15),
  VITE_SOCKET_RECONNECT_DELAY_MS: positiveInteger(1000),
  VITE_HEARTBEAT_INTERVAL_MS: positiveInteger(4000),
  VITE_HEARTBEAT_TIMEOUT_MS: positiveInteger(3000),
  VITE_SIMULATION_INTERVAL_MS: positiveInteger(600),
  VITE_SIMULATION_STEP_PERCENT: positiveInteger(5).pipe(z.number().max(100)),
});
