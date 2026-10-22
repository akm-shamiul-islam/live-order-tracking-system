import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import type { Model } from 'mongoose';
import { AuthOtpService } from './auth-otp.service.js';
import type { RecoveryMailer } from './recovery-mailer.js';
import type {
  AuthChallenge,
  AuthChallengeDocument,
} from '../database/schemas/auth-challenge.schema.js';
import type { UserDocument } from '../database/schemas/user.schema.js';

const secret = 'isolated-otp-regression-secret';
const code = '123456';
type ChallengeData = { [Key in keyof AuthChallenge]: AuthChallenge[Key] };
const warning = vi.fn<(message: unknown) => void>();

function fixture(): ChallengeData {
  const id = 'A'.repeat(43);
  return {
    _id: id,
    challengeKey: 'test-challenge-key',
    userId: null,
    userTokenVersion: null,
    email: 'customer@example.test',
    purpose: 'password_reset',
    language: 'en',
    codeHash: createHmac('sha256', secret)
      .update(`otp\0password_reset\0${id}\0${code}`)
      .digest('hex'),
    attempts: 0,
    expiresAt: new Date(Date.now() + 600_000),
    lastSentAt: new Date(),
    resendAvailableAt: new Date(Date.now() + 60_000),
    verifiedAt: null,
    consumedAt: null,
  };
}

function setup() {
  const record = fixture();
  const model = {
    findById: vi.fn<() => { select: () => Promise<ChallengeData> }>(() => ({
      select: async () => ({ ...record }),
    })),
    findOne: vi.fn<() => { select: () => Promise<null> }>(() => ({ select: async () => null })),
    create: vi.fn<(value: ChallengeData) => Promise<ChallengeData>>(async (value) => value),
    findOneAndUpdate: vi.fn<
      (
        filter: { attempts: number | { $lt: number } },
        update: { $inc?: { attempts: number }; $set?: { verifiedAt: Date } },
      ) => Promise<ChallengeData | null>
    >(async (filter, update) => {
      // Model the database's conditional atomic write, including a concurrent attempt.
      if (
        record.verifiedAt ||
        record.consumedAt ||
        (typeof filter.attempts === 'number'
          ? record.attempts !== filter.attempts
          : record.attempts >= filter.attempts.$lt)
      )
        return null;
      if (update.$inc) record.attempts += update.$inc.attempts;
      if (update.$set) record.verifiedAt = update.$set.verifiedAt;
      return { ...record };
    }),
    updateOne: vi.fn<() => { exec: () => Promise<unknown> }>(),
  };
  const mailer = {
    isConfigured: vi.fn<RecoveryMailer['isConfigured']>(() => true),
    sendOtp: vi.fn<RecoveryMailer['sendOtp']>().mockResolvedValue(undefined),
  };
  // The doubles implement only the model/mailer operations exercised by these regressions.
  const service = new AuthOtpService(
    model as unknown as Model<AuthChallengeDocument>,
    {} as Model<UserDocument>,
    mailer as unknown as RecoveryMailer,
  );
  return { service, record, model, mailer };
}

describe('OTP retries and concurrent verification', () => {
  beforeEach(() => {
    vi.stubEnv('JWT_SECRET', secret);
    vi.stubEnv('AUTH_OTP_MAX_ATTEMPTS', '3');
    warning.mockClear();
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(warning);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('does not consume a replacement code when a stale wrong attempt loses its write', async () => {
    const { service, model } = setup();
    model.findOneAndUpdate.mockResolvedValue(null);
    await expect(service.verify('A'.repeat(43), '654321', 'password_reset')).rejects.toThrow(
      BadRequestException,
    );
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('accepts the correct code when another wrong attempt increments the counter after its read', async () => {
    const { service, model, record } = setup();
    model.findById.mockImplementation(() => ({
      select: async () => {
        const snapshot = { ...record };
        record.attempts += 1;
        return snapshot;
      },
    }));
    await expect(service.verify(record._id, code, 'password_reset')).resolves.toMatchObject({
      verifiedAt: expect.any(Date),
      attempts: 1,
    });
  });

  it('counts concurrent wrong attempts without exceeding the configured budget', async () => {
    const { service, record } = setup();
    const outcomes = await Promise.allSettled(
      Array.from({ length: 5 }, () => service.verify(record._id, '654321', 'password_reset')),
    );
    expect(outcomes.every((outcome) => outcome.status === 'rejected')).toBe(true);
    expect(record.attempts).toBe(3);
    expect(record.verifiedAt).toBeNull();
    await expect(service.verify(record._id, code, 'password_reset')).rejects.toThrow(
      'Too many incorrect codes',
    );
  });

  it('executes the retry update after asynchronous SMTP failure and handles storage failure', async () => {
    const { service, model, mailer } = setup();
    mailer.sendOtp.mockRejectedValue(new Error('Synthetic SMTP outage'));
    const executeRetry = vi.fn<() => Promise<never>>(async () => {
      throw new Error('Synthetic database outage');
    });
    model.updateOne.mockReturnValue({ exec: executeRetry });
    await expect(
      service.begin('customer@example.test', 'password_reset', null, undefined, true, false),
    ).resolves.toMatchObject({ status: 'verification_required' });
    await vi.waitFor(() => expect(executeRetry).toHaveBeenCalledOnce());
    await vi.waitFor(() =>
      expect(warning).toHaveBeenCalledWith('The verification email retry could not be scheduled.'),
    );
  });
});
