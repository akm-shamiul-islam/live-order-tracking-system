import { describe, expect, it } from 'vitest';
import { ClientSettingsSchema } from './client-settings-schema';

describe('Public browser settings', () => {
  it('accepts explicit client settings while discarding private environment values', () => {
    const settings = ClientSettingsSchema.parse({
      VITE_REQUEST_TIMEOUT_MS: '20000',
      VITE_SOCKET_ACK_TIMEOUT_MS: '7000',
      JWT_SECRET: 'private-test-secret',
    });
    expect(settings).toMatchObject({
      VITE_REQUEST_TIMEOUT_MS: 20000,
      VITE_SOCKET_ACK_TIMEOUT_MS: 7000,
    });
    expect(settings).not.toHaveProperty('JWT_SECRET');
  });
  it.each([
    { VITE_REQUEST_TIMEOUT_MS: '0' },
    { VITE_QUERY_RETRY_COUNT: '-1' },
    { VITE_SIMULATION_STEP_PERCENT: '101' },
  ])('rejects invalid public settings %j', (settings) => {
    expect(ClientSettingsSchema.safeParse(settings).success).toBe(false);
  });
});
