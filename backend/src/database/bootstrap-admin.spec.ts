import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { SeedService } from './seed.service.js';
import type { UserDocument } from './schemas/user.schema.js';

afterEach(() => vi.unstubAllEnvs());
describe('Explicit first-administrator provisioning', () => {
  function fixture() {
    const findOne = vi.fn<(filter: unknown) => Promise<unknown>>().mockResolvedValue(null);
    const create = vi
      .fn<(data: { email: string; role: string; passwordHash: string }) => Promise<void>>()
      .mockResolvedValue(undefined);
    return {
      findOne,
      create,
      service: new SeedService({ findOne, create } as unknown as Model<UserDocument>),
    };
  }
  function configure() {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BOOTSTRAP_ADMIN_EMAIL', ' ADMIN@EXAMPLE.TEST ');
    vi.stubEnv('BOOTSTRAP_ADMIN_PASSWORD', 'Operator-chosen-password123!');
    vi.stubEnv('PASSWORD_HASH_ROUNDS', '10');
  }
  it('requires explicit production credentials and preserves existing accounts', async () => {
    const { service, findOne, create } = fixture();
    vi.stubEnv('NODE_ENV', 'development');
    await expect(service.bootstrapAdministrator()).rejects.toThrow('NODE_ENV=production');
    expect(findOne).not.toHaveBeenCalled();
    configure();
    findOne.mockResolvedValueOnce({ role: 'ADMIN' });
    await expect(service.bootstrapAdministrator()).rejects.toThrow('already exists');
    expect(create).not.toHaveBeenCalled();
    findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ role: 'CUSTOMER' });
    await expect(service.bootstrapAdministrator()).rejects.toThrow(
      'No role or password was changed',
    );
    expect(create).not.toHaveBeenCalled();
  });
  it('creates an explicitly requested administrator with a normalized email and hashed password', async () => {
    configure();
    const { service, create } = fixture();
    await service.bootstrapAdministrator();
    const data = create.mock.calls[0]![0];
    expect(data.email).toBe('admin@example.test');
    expect(data.role).toBe('ADMIN');
    expect(await bcrypt.compare('Operator-chosen-password123!', data.passwordHash)).toBe(true);
  });
});
