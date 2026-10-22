import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { SeedService } from './seed.service.js';
import type { UserDocument } from './schemas/user.schema.js';
import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';

describe('Explicit development administrator recovery', () => {
  type Account = {
    passwordHash: string;
    role: string;
    name?: string;
    tokenVersion?: number;
    save: () => Promise<void>;
  };
  const findOne = vi.fn<(filter: { email: string }) => Promise<Account | null>>();
  const save = vi.fn<() => Promise<void>>();
  const findOneAndUpdate = vi.fn<(...args: unknown[]) => Promise<Account | null>>();
  const service = new SeedService({ findOne, findOneAndUpdate } as unknown as Model<UserDocument>);

  beforeEach(() => {
    findOne.mockReset();
    save.mockReset().mockResolvedValue(undefined);
    findOneAndUpdate.mockReset();
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('ADMIN_DEFAULT_EMAIL', ' ADMIN@KITCHENTODOOR.IO ');
    vi.stubEnv('ADMIN_DEFAULT_PASSWORD', 'KitchenAdmin#2026!Secure');
  });

  afterEach(() => vi.unstubAllEnvs());

  it('preserves the full example passwords when dotenv parses # characters', () => {
    const environment = parse(readFileSync(new URL('../../../.env.example', import.meta.url)));
    expect(environment.ADMIN_DEFAULT_PASSWORD).toBe('KitchenAdmin#2026!Secure');
    expect(environment.COURIER_DEFAULT_PASSWORD).toBe('Courier#2026!Speed');
  });

  it('restores the configured administrator password without changing role or profile', async () => {
    const admin = {
      passwordHash: 'previous-hash',
      role: 'ADMIN',
      name: 'Existing Admin',
      tokenVersion: 3,
      save,
    };
    findOne.mockResolvedValue(admin);
    findOneAndUpdate.mockResolvedValue(admin);
    await service.resetDevelopmentAdmin();
    expect(findOne).toHaveBeenCalledWith({ email: 'admin@kitchentodoor.io' });
    const mutation = findOneAndUpdate.mock.calls[0]?.[1] as {
      $set: { passwordHash: string };
      $inc: { tokenVersion: number; profileVersion: number };
      $unset: Record<string, number>;
    };
    expect(await bcrypt.compare('KitchenAdmin#2026!Secure', mutation.$set.passwordHash)).toBe(true);
    expect(admin.role).toBe('ADMIN');
    expect(admin.name).toBe('Existing Admin');
    expect(mutation.$inc).toEqual({ tokenVersion: 1, profileVersion: 1 });
    expect(mutation.$unset).toEqual({ resetTokenHash: 1, resetExpiresAt: 1, resetRequestedAt: 1 });
    expect(save).not.toHaveBeenCalled();
  });

  it.each(['production', 'test', ''])('refuses password changes in %s', async (environment) => {
    vi.stubEnv('NODE_ENV', environment);
    await expect(service.resetDevelopmentAdmin()).rejects.toThrow('NODE_ENV=development');
    expect(findOne).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses to overwrite an administrator changed during password recovery', async () => {
    findOne.mockResolvedValue({
      passwordHash: 'previous-hash',
      role: 'ADMIN',
      tokenVersion: 3,
      save,
    });
    findOneAndUpdate.mockResolvedValue(null);
    await expect(service.resetDevelopmentAdmin()).rejects.toThrow('changed during recovery');
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'ADMIN',
        $expr: {
          $and: [
            { $eq: [{ $ifNull: ['$tokenVersion', 0] }, 3] },
            { $eq: [{ $ifNull: ['$profileVersion', 0] }, 0] },
          ],
        },
      }),
      expect.any(Object),
      { returnDocument: 'after', runValidators: true },
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses to turn an existing customer into an administrator', async () => {
    const customer = { passwordHash: 'original-hash', role: 'CUSTOMER', save };
    findOne.mockResolvedValue(customer);
    await expect(service.resetDevelopmentAdmin()).rejects.toThrow('No account was changed');
    expect(customer.passwordHash).toBe('original-hash');
    expect(save).not.toHaveBeenCalled();
  });

  it('requires a configured administrator email instead of a hardcoded account', async () => {
    vi.stubEnv('ADMIN_DEFAULT_EMAIL', '');
    await expect(service.resetDevelopmentAdmin()).rejects.toThrow('ADMIN_DEFAULT_EMAIL');
    expect(findOne).not.toHaveBeenCalled();
  });

  it('requires a configured password instead of falling back to a public sample', async () => {
    vi.stubEnv('ADMIN_DEFAULT_PASSWORD', '');
    findOne.mockResolvedValue({ passwordHash: 'original-hash', role: 'ADMIN', save });
    await expect(service.resetDevelopmentAdmin()).rejects.toThrow('ADMIN_DEFAULT_PASSWORD');
    expect(save).not.toHaveBeenCalled();
  });

  it('reports an account that does not exist', async () => {
    findOne.mockResolvedValue(null);
    await expect(service.resetDevelopmentAdmin()).rejects.toThrow('not found');
    expect(save).not.toHaveBeenCalled();
  });
});
