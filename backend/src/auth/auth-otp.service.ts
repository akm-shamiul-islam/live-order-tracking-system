import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { Model, Types } from 'mongoose';
import type { AuthChallengeResponse, AuthOtpPurpose, Language } from '@kitchentodoor/shared';
import { getRuntimeSettings } from '../config/runtime-settings.js';
import {
  AuthChallenge,
  type AuthChallengeDocument,
} from '../database/schemas/auth-challenge.schema.js';
import { User, type UserDocument } from '../database/schemas/user.schema.js';
import { getJwtSecret } from './jwt.config.js';
import { RecoveryMailer } from './recovery-mailer.js';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const rateLimited = (message: string) => new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);

@Injectable()
export class AuthOtpService {
  private readonly logger = new Logger(AuthOtpService.name);

  constructor(
    @InjectModel(AuthChallenge.name)
    private readonly challengeModel: Model<AuthChallengeDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @Inject(RecoveryMailer) private readonly mailer: RecoveryMailer,
  ) {}

  hashDeviceId(deviceId: string): string {
    return createHmac('sha256', getJwtSecret()).update(`device\0${deviceId}`).digest('hex');
  }

  requireConfigured(): void {
    if (!this.mailer.isConfigured())
      throw new ServiceUnavailableException(
        'Email verification is not configured. Ask the site administrator to configure SMTP.',
      );
  }

  async begin(
    email: string,
    purpose: AuthOtpPurpose,
    userId: string | null,
    deviceId?: string,
    deliver = true,
    waitForDelivery = true,
    deviceHashOverride?: string,
    language?: Language,
  ): Promise<AuthChallengeResponse> {
    if (deliver && !this.mailer.isConfigured() && purpose !== 'password_reset')
      this.requireConfigured();
    if (purpose === 'password_reset' && !this.mailer.isConfigured()) deliver = false;

    const settings = getRuntimeSettings();
    const normalizedEmail = email.trim().toLowerCase();
    const deviceHash = deviceHashOverride || (deviceId ? this.hashDeviceId(deviceId) : undefined);
    const challengeKey = digest(`${purpose}\0${normalizedEmail}\0${deviceHash || ''}`);
    const now = new Date();
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = new Date(now.getTime() + settings.AUTH_OTP_TTL_SECONDS * 1000);
    const resendAvailableAt = new Date(now.getTime() + settings.AUTH_OTP_RESEND_SECONDS * 1000);
    const previous = await this.challengeModel
      .findOne({ challengeKey })
      .select('+challengeKey +codeHash +deviceHash +resetGrantHash +resetGrantExpiresAt');
    const user = userId
      ? await this.userModel.findById(userId).select('email language tokenVersion disabled')
      : null;
    const replacingDummy = Boolean(deliver && previous && !previous.userId && userId);

    if (
      previous &&
      previous.expiresAt.getTime() > now.getTime() &&
      !previous.verifiedAt &&
      !previous.consumedAt &&
      previous.resendAvailableAt.getTime() > now.getTime() &&
      !replacingDummy
    ) {
      return this.response(previous);
    }

    const challengeId = previous?._id || randomBytes(32).toString('base64url');
    const actualCodeHash = this.hashCode(challengeId, purpose, code);
    const update = {
      email: normalizedEmail,
      purpose,
      language: language || (user?.language === 'ja' ? 'ja' : 'en'),
      userId: userId ? new Types.ObjectId(userId) : null,
      userTokenVersion: user ? user.tokenVersion || 0 : null,
      ...(deviceHash ? { deviceHash } : {}),
      codeHash: actualCodeHash,
      attempts: 0,
      expiresAt,
      lastSentAt: now,
      resendAvailableAt,
      verifiedAt: null,
      consumedAt: null,
    };

    let challenge: AuthChallengeDocument | null;
    try {
      if (previous) {
        challenge = await this.challengeModel
          .findOneAndUpdate(
            {
              _id: previous._id,
              codeHash: previous.codeHash,
              verifiedAt: previous.verifiedAt ?? null,
              consumedAt: previous.consumedAt ?? null,
              ...(!previous.verifiedAt && !previous.consumedAt && !replacingDummy
                ? { resendAvailableAt: { $lte: now } }
                : {}),
            },
            {
              $set: update,
              $unset: { resetGrantHash: 1, resetGrantExpiresAt: 1 },
            },
            { returnDocument: 'after', runValidators: true },
          )
          .select('+challengeKey +codeHash +deviceHash +resetGrantHash +resetGrantExpiresAt');
      } else {
        challenge = await this.challengeModel.create({
          _id: challengeId,
          challengeKey,
          ...update,
        });
      }
    } catch (error) {
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 11000)
        throw error;
      const raced = await this.challengeModel
        .findOne({ challengeKey })
        .select('+challengeKey +codeHash +deviceHash +resetGrantHash +resetGrantExpiresAt');
      if (raced) return this.response(raced);
      throw error;
    }
    if (!challenge) {
      const current = await this.challengeModel
        .findById(challengeId)
        .select('+challengeKey +codeHash +deviceHash +resetGrantHash +resetGrantExpiresAt');
      if (current) return this.response(current);
      throw new BadRequestException('Request a new verification code and try again.');
    }

    if (deliver) {
      const messageLanguage: Language = challenge.language === 'ja' ? 'ja' : 'en';
      const send = this.mailer.sendOtp(
        normalizedEmail,
        purpose,
        code,
        settings.AUTH_OTP_TTL_SECONDS,
        messageLanguage,
      );
      if (waitForDelivery) {
        try {
          await send;
        } catch {
          if (!previous)
            await this.challengeModel.deleteOne({ _id: challenge._id, codeHash: actualCodeHash });
          else {
            await this.challengeModel.updateOne(
              { _id: challenge._id, codeHash: actualCodeHash },
              {
                $set: {
                  codeHash: previous.codeHash,
                  attempts: previous.attempts,
                  expiresAt: previous.expiresAt,
                  lastSentAt: previous.lastSentAt,
                  resendAvailableAt: previous.resendAvailableAt,
                  verifiedAt: previous.verifiedAt ?? null,
                  consumedAt: previous.consumedAt ?? null,
                },
              },
            );
          }
          throw new ServiceUnavailableException(
            'The verification email could not be sent. Check the mail configuration and try again.',
          );
        }
      } else {
        void send.catch(() => {
          this.logger.warn('An account verification email could not be delivered.');
          void this.challengeModel
            .updateOne(
              { _id: challenge._id, codeHash: actualCodeHash },
              { $set: { resendAvailableAt: new Date() } },
            )
            .exec()
            .catch(() => this.logger.warn('The verification email retry could not be scheduled.'));
        });
      }
    }
    return this.response(challenge);
  }

  async resend(challengeId: string): Promise<AuthChallengeResponse> {
    const challenge = await this.challengeModel
      .findById(challengeId)
      .select('+challengeKey +codeHash +deviceHash +resetGrantHash +resetGrantExpiresAt');
    if (!challenge || challenge.verifiedAt || challenge.consumedAt)
      throw new BadRequestException('This verification request is no longer active. Start again.');
    const seconds = Math.ceil((challenge.resendAvailableAt.getTime() - Date.now()) / 1000);
    if (seconds > 0) throw rateLimited(`Request another code in ${seconds} seconds.`);
    return this.begin(
      challenge.email,
      challenge.purpose,
      challenge.userId?.toString() || null,
      undefined,
      Boolean(challenge.userId),
      challenge.purpose !== 'password_reset',
      challenge.deviceHash,
      challenge.language,
    );
  }

  async verify(
    challengeId: string,
    code: string,
    purpose: AuthOtpPurpose,
    deviceId?: string,
  ): Promise<AuthChallengeDocument> {
    const settings = getRuntimeSettings();
    const challenge = await this.challengeModel
      .findById(challengeId)
      .select('+challengeKey +codeHash +deviceHash +resetGrantHash +resetGrantExpiresAt');
    const now = new Date();
    if (
      !challenge ||
      challenge.purpose !== purpose ||
      challenge.expiresAt.getTime() <= now.getTime() ||
      challenge.verifiedAt ||
      challenge.consumedAt
    )
      throw new BadRequestException(
        'This verification code is invalid or expired. Request a new code.',
      );
    if (challenge.attempts >= settings.AUTH_OTP_MAX_ATTEMPTS)
      throw rateLimited('Too many incorrect codes. Request a new verification code.');
    if (purpose === 'new_device_login' || purpose === 'email_verification') {
      if (!deviceId || (!challenge.deviceHash && purpose === 'new_device_login'))
        throw new BadRequestException('This verification request is invalid. Start sign-in again.');
      if (purpose === 'new_device_login' && this.hashDeviceId(deviceId) !== challenge.deviceHash)
        throw new BadRequestException('This verification request belongs to another device.');
    }

    const supplied = this.hashCode(challenge._id, purpose, code);
    const matches = timingSafeEqual(
      Buffer.from(supplied, 'hex'),
      Buffer.from(challenge.codeHash, 'hex'),
    );
    if (!matches) {
      const failed = await this.challengeModel.findOneAndUpdate(
        {
          _id: challenge._id,
          codeHash: challenge.codeHash,
          attempts: { $lt: settings.AUTH_OTP_MAX_ATTEMPTS },
          verifiedAt: null,
          consumedAt: null,
          expiresAt: { $gt: now },
        },
        { $inc: { attempts: 1 } },
        { returnDocument: 'after' },
      );
      // A resend or a successful verification may have replaced this snapshot.
      // Never consume the current code because an older verification lost a race.
      if (!failed)
        throw new BadRequestException(
          'This verification code is invalid or expired. Request a new code.',
        );
      if (failed.attempts >= settings.AUTH_OTP_MAX_ATTEMPTS) {
        throw rateLimited('Too many incorrect codes. Request a new verification code.');
      }
      throw new BadRequestException('The verification code is incorrect. Try again.');
    }

    const verified = await this.challengeModel.findOneAndUpdate(
      {
        _id: challenge._id,
        codeHash: challenge.codeHash,
        attempts: { $lt: settings.AUTH_OTP_MAX_ATTEMPTS },
        verifiedAt: null,
        consumedAt: null,
        expiresAt: { $gt: now },
      },
      { $set: { verifiedAt: now } },
      { returnDocument: 'after' },
    );
    if (!verified)
      throw new BadRequestException(
        'This verification code is invalid or expired. Request a new code.',
      );
    return verified;
  }

  async createResetGrant(challenge: AuthChallengeDocument, code: string): Promise<string> {
    if (
      challenge.purpose !== 'password_reset' ||
      !challenge.userId ||
      !challenge.verifiedAt ||
      challenge.userTokenVersion === null
    )
      throw new BadRequestException('This reset code is invalid or expired. Request a new code.');
    const user = await this.userModel
      .findOne({
        _id: challenge.userId,
        email: challenge.email,
        tokenVersion: challenge.userTokenVersion ?? 0,
        disabled: { $ne: true },
        emailVerified: { $ne: false },
      })
      .select('_id');
    if (!user)
      throw new BadRequestException('This reset code is invalid or expired. Request a new code.');
    const token = `reset_${randomBytes(32).toString('base64url')}`;
    const expiresAt = new Date(Date.now() + getRuntimeSettings().AUTH_OTP_TTL_SECONDS * 1000);
    const updated = await this.challengeModel.findOneAndUpdate(
      {
        _id: challenge._id,
        purpose: 'password_reset',
        userId: challenge.userId,
        userTokenVersion: challenge.userTokenVersion,
        codeHash: this.hashCode(challenge._id, 'password_reset', code),
        verifiedAt: challenge.verifiedAt,
        lastSentAt: challenge.lastSentAt,
        expiresAt: { $gt: new Date() },
        consumedAt: null,
        // Exchange one verified code once; a delayed/resubmitted exchange must
        // neither acquire another generation's authority nor replace its grant.
        resetGrantHash: { $exists: false },
      },
      {
        $set: {
          resetGrantHash: digest(token),
          resetGrantExpiresAt: expiresAt,
          expiresAt,
        },
      },
      { returnDocument: 'after' },
    );
    if (!updated) throw new BadRequestException('This password reset code has already been used.');
    return token;
  }

  async consumeResetGrant(
    token: string,
  ): Promise<{ userId: string; email: string; userTokenVersion: number }> {
    const grant = await this.challengeModel.findOneAndUpdate(
      {
        resetGrantHash: digest(token),
        resetGrantExpiresAt: { $gt: new Date() },
        verifiedAt: { $ne: null },
        consumedAt: null,
      },
      {
        $set: { consumedAt: new Date() },
        $unset: { resetGrantHash: 1, resetGrantExpiresAt: 1 },
      },
      { returnDocument: 'after' },
    );
    if (!grant?.userId || grant.userTokenVersion === null)
      throw new BadRequestException('This reset code is invalid or expired. Request a new code.');
    return {
      userId: grant.userId.toString(),
      email: grant.email,
      userTokenVersion: grant.userTokenVersion,
    };
  }

  private hashCode(challengeId: string, purpose: AuthOtpPurpose, code: string): string {
    return createHmac('sha256', getJwtSecret())
      .update(`otp\0${purpose}\0${challengeId}\0${code}`)
      .digest('hex');
  }

  private response(challenge: AuthChallengeDocument): AuthChallengeResponse {
    return {
      status: 'verification_required',
      purpose: challenge.purpose,
      challengeId: challenge._id,
      email: challenge.email,
      expiresAt: challenge.expiresAt.toISOString(),
      resendAvailableAt: challenge.resendAvailableAt.toISOString(),
    };
  }
}
