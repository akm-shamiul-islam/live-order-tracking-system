import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Inject,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes, createHash } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { User, type UserDocument } from '../database/schemas/user.schema.js';
import {
  type LoginDto,
  type RegisterDto,
  type AuthResponse,
  type AuthChallengeResponse,
  type UserSummary,
  UserRole,
} from '@kitchentodoor/shared';
import { getRuntimeSettings } from '../config/runtime-settings.js';
import { AuthSession, type AuthSessionDocument } from '../database/schemas/auth-session.schema.js';
import { RecoveryMailer } from './recovery-mailer.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { AuthOtpService } from './auth-otp.service.js';

type IssuedSession = AuthResponse & { refreshToken: string };
const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex');

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @InjectModel(AuthSession.name) private readonly sessionModel: Model<AuthSessionDocument>,
    @Inject(RecoveryMailer) private readonly recoveryMailer: RecoveryMailer,
    @Inject(ProfilesService) private readonly profiles: ProfilesService,
    @Inject(AuthOtpService) private readonly otp: AuthOtpService,
  ) {}

  async validateUser(email: string, pass: string): Promise<UserDocument | null> {
    const user = await this.userModel.findOne(
      { email: email.trim().toLowerCase() },
      '+trustedDeviceHashes',
    );
    if (!user || user.disabled) return null;
    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) return null;
    return user;
  }

  async login(loginDto: LoginDto): Promise<IssuedSession | AuthChallengeResponse> {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.emailVerified === false)
      throw new UnauthorizedException('Verify your email address before signing in.');
    const deviceHash = this.otp.hashDeviceId(loginDto.deviceId);
    if (user.trustedDeviceHashes?.includes(deviceHash)) return this.issueSession(user);
    return this.otp.begin(user.email, 'new_device_login', user._id.toString(), loginDto.deviceId);
  }

  async register(registerDto: RegisterDto): Promise<AuthChallengeResponse> {
    this.otp.requireConfigured();
    const existing = await this.userModel.findOne({ email: registerDto.email.toLowerCase() });
    if (existing) {
      throw new ConflictException('A user with this email address already exists');
    }

    const salt = await bcrypt.genSalt(getRuntimeSettings().PASSWORD_HASH_ROUNDS);
    const passwordHash = await bcrypt.hash(registerDto.password, salt);

    const userId = new Types.ObjectId();
    const registrationPhotoId = registerDto.photo
      ? await this.profiles.preparePhoto(userId.toString(), registerDto.photo)
      : undefined;
    let newUser: UserDocument;
    try {
      newUser = await this.userModel.create({
        _id: userId,
        registrationPhotoId,
        name: registerDto.name,
        email: registerDto.email.toLowerCase(),
        passwordHash,
        role: UserRole.CUSTOMER,
        emailVerified: false,
        trustedDeviceHashes: [],
        phone: registerDto.phone,
        address: registerDto.address || undefined,
        language: registerDto.language ?? 'en',
      });
    } catch (error) {
      if (registrationPhotoId)
        await this.profiles.discardPhoto(registrationPhotoId).catch(() => undefined);
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000)
        throw new ConflictException('A user with this email address already exists');
      throw error;
    }

    try {
      return await this.otp.begin(newUser.email, 'email_verification', newUser._id.toString());
    } catch (error) {
      await this.userModel.deleteOne({ _id: newUser._id }).catch(() => undefined);
      if (registrationPhotoId)
        await this.profiles.discardPhoto(registrationPhotoId).catch(() => undefined);
      throw error;
    }
  }

  private summary(user: UserDocument): UserSummary {
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      address: user.address,
      photoId: user.photoId || null,
      profileVersion: user.profileVersion ?? 0,
      language: user.language ?? 'en',
      languageVersion: user.languageVersion ?? 0,
    };
  }

  private async issueSession(user: UserDocument): Promise<IssuedSession> {
    const id = new Types.ObjectId();
    const refreshToken = `${id.toString()}.${randomBytes(32).toString('base64url')}`;
    await this.sessionModel.create({
      _id: id,
      userId: user._id,
      refreshHash: tokenHash(refreshToken),
      tokenVersion: user.tokenVersion || 0,
      expiresAt: new Date(Date.now() + getRuntimeSettings().AUTH_SESSION_TTL_MS),
    });
    return {
      accessToken: this.signAccess(user, id.toString()),
      user: this.summary(user),
      refreshToken,
    };
  }

  async verifyEmail(challengeId: string, code: string, deviceId: string): Promise<IssuedSession> {
    const challenge = await this.otp.verify(challengeId, code, 'email_verification', deviceId);
    if (!challenge.userId)
      throw new BadRequestException('This verification request is no longer available.');
    const user = await this.userModel
      .findOneAndUpdate(
        {
          _id: challenge.userId,
          email: challenge.email,
          tokenVersion: challenge.userTokenVersion ?? 0,
          disabled: { $ne: true },
          emailVerified: { $ne: true },
        },
        { $set: { emailVerified: true, emailVerifiedAt: new Date() } },
        { returnDocument: 'after', runValidators: true },
      )
      .select('+registrationPhotoId +trustedDeviceHashes');
    if (!user)
      throw new BadRequestException('This account is already active or no longer available.');
    if (user.registrationPhotoId)
      await this.profiles.registrationPhoto(user).catch(() => {
        this.logger.warn('The registration photo review will be created after storage recovers.');
      });
    await this.rememberDevice(user, this.otp.hashDeviceId(deviceId));
    return this.issueSession(user);
  }

  async verifyNewDevice(
    challengeId: string,
    code: string,
    deviceId: string,
  ): Promise<IssuedSession> {
    const challenge = await this.otp.verify(challengeId, code, 'new_device_login', deviceId);
    if (!challenge.userId)
      throw new BadRequestException('This verification request is no longer available.');
    const user = await this.userModel.findById(challenge.userId).select('+trustedDeviceHashes');
    if (
      !user ||
      user.disabled ||
      user.email !== challenge.email ||
      (user.tokenVersion || 0) !== (challenge.userTokenVersion ?? 0) ||
      user.emailVerified === false
    )
      throw new UnauthorizedException('Your account is unavailable. Please sign in again.');
    // verify() binds the supplied device ID to the challenge's stored hash.
    // Hash that validated ID here instead of reading the schema-hidden field
    // from findOneAndUpdate's returned document.
    await this.rememberDevice(user, this.otp.hashDeviceId(deviceId));
    return this.issueSession(user);
  }

  private async rememberDevice(user: UserDocument, deviceHash: string): Promise<void> {
    const result = await this.userModel.updateOne(
      {
        _id: user._id,
        tokenVersion: user.tokenVersion || 0,
        disabled: { $ne: true },
        emailVerified: { $ne: false },
        trustedDeviceHashes: { $ne: deviceHash },
      },
      {
        $push: {
          trustedDeviceHashes: {
            $each: [deviceHash],
            $slice: -getRuntimeSettings().AUTH_TRUSTED_DEVICES_MAX,
          },
        },
      },
    );
    if (!result.matchedCount) {
      const alreadyTrusted = await this.userModel.exists({
        _id: user._id,
        tokenVersion: user.tokenVersion || 0,
        disabled: { $ne: true },
        emailVerified: { $ne: false },
        trustedDeviceHashes: deviceHash,
      });
      if (alreadyTrusted) return;
      throw new UnauthorizedException('Your account changed. Please sign in again.');
    }
  }

  private signAccess(user: UserDocument, sessionId: string): string {
    return this.jwtService.sign({
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
      ver: user.tokenVersion || 0,
      sid: sessionId,
    });
  }

  async refresh(refreshToken: string): Promise<IssuedSession> {
    if (!/^[a-f\d]{24}\.[A-Za-z0-9_-]{43}$/.test(refreshToken))
      throw new UnauthorizedException('Please sign in again.');
    const sessionId = refreshToken.split('.')[0]!;
    const hash = tokenHash(refreshToken);
    const session = await this.sessionModel.findById(sessionId);
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now())
      throw new UnauthorizedException('Please sign in again.');
    const user = await this.userModel.findById(session.userId);
    if (!user || user.disabled || (user.tokenVersion || 0) !== session.tokenVersion)
      throw new UnauthorizedException('Please sign in again.');
    const next = `${sessionId}.${randomBytes(32).toString('base64url')}`;
    const rotated = await this.sessionModel.findOneAndUpdate(
      { _id: sessionId, refreshHash: hash, revokedAt: null, expiresAt: { $gt: new Date() } },
      {
        $set: { refreshHash: tokenHash(next) },
        $push: {
          usedHashes: { $each: [hash], $slice: -getRuntimeSettings().AUTH_REFRESH_HISTORY_MAX },
        },
      },
      { returnDocument: 'after' },
    );
    if (!rotated) {
      // A known previous token indicates reuse. A random invalid secret cannot revoke a session.
      await this.sessionModel.updateOne(
        { _id: sessionId, usedHashes: hash },
        { $set: { revokedAt: new Date() } },
      );
      throw new UnauthorizedException('Please sign in again.');
    }
    return {
      accessToken: this.signAccess(user, sessionId),
      user: this.summary(user),
      refreshToken: next,
    };
  }

  async verifyToken(token: string): Promise<UserSummary> {
    let decoded: { sub: string; ver?: number; sid?: string };
    try {
      decoded = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
    return this.validateSession(decoded);
  }

  async findById(id: string): Promise<UserSummary | null> {
    const user = await this.userModel.findById(id);
    if (!user || user.disabled) return null;
    return this.summary(user);
  }

  async updateLanguage(
    id: string,
    language: 'en' | 'ja',
  ): Promise<{ language: 'en' | 'ja'; languageVersion: number }> {
    const user = await this.userModel.findOneAndUpdate(
      { _id: id, disabled: { $ne: true } },
      { $set: { language }, $inc: { languageVersion: 1 } },
      { returnDocument: 'after', runValidators: true },
    );
    if (!user)
      throw new UnauthorizedException('Your account is no longer available. Please sign in again.');
    return { language: user.language ?? 'en', languageVersion: user.languageVersion ?? 0 };
  }

  async validateSession(payload: {
    sub: string;
    ver?: number;
    sid?: string;
  }): Promise<UserSummary> {
    if (!payload.sub) throw new UnauthorizedException('Please sign in again.');
    const user = await this.userModel.findById(payload.sub);
    if (!user || user.disabled || (user.tokenVersion || 0) !== (payload.ver || 0)) {
      throw new UnauthorizedException('Your session has expired. Please sign in again.');
    }
    if (
      payload.sid &&
      !(await this.sessionModel.exists({
        _id: payload.sid,
        userId: user._id,
        tokenVersion: user.tokenVersion || 0,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      }))
    ) {
      throw new UnauthorizedException('Your session has expired. Please sign in again.');
    }
    return this.summary(user);
  }

  async revokeSessions(userId: string): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
    await this.markSessionsRevoked(userId);
  }

  private async markSessionsRevoked(userId: string): Promise<void> {
    try {
      await this.sessionModel.updateMany({ userId }, { $set: { revokedAt: new Date() } });
    } catch {
      // The user's version was already changed atomically. Both access verification and
      // refresh reject previous versions even if this housekeeping write is unavailable.
      this.logger.warn('Session cleanup could not be saved. Previous credentials remain invalid.');
    }
  }

  async logout(accessToken?: string, refreshToken?: string): Promise<void> {
    if (refreshToken && /^[a-f\d]{24}\.[A-Za-z0-9_-]{43}$/.test(refreshToken)) {
      const session = await this.sessionModel.findOne({
        _id: refreshToken.split('.')[0],
        refreshHash: tokenHash(refreshToken),
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      });
      if (session) return this.revokeSessions(session.userId.toString());
    }
    if (accessToken) {
      try {
        const user = await this.verifyToken(accessToken.replace(/^Bearer\s+/i, ''));
        await this.revokeSessions(user.id);
      } catch (error) {
        if (!(error instanceof UnauthorizedException)) throw error;
      }
    }
  }

  async forgotPassword(email: string): Promise<AuthChallengeResponse> {
    this.otp.requireConfigured();
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userModel.findOne({
      email: normalizedEmail,
      disabled: { $ne: true },
      emailVerified: { $ne: false },
    });
    // Unknown and disabled accounts receive the same response shape. A dummy challenge
    // also keeps later verification/resend requests indistinguishable from real accounts.
    return this.otp.begin(
      normalizedEmail,
      'password_reset',
      user?._id.toString() || null,
      undefined,
      Boolean(user),
      false,
    );
  }

  async requestEmailVerification(email: string): Promise<AuthChallengeResponse> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userModel.findOne({
      email: normalizedEmail,
      disabled: { $ne: true },
      emailVerified: false,
    });
    return this.otp.begin(
      normalizedEmail,
      'email_verification',
      user?._id.toString() || null,
      undefined,
      Boolean(user),
      false,
      undefined,
      user?.language,
    );
  }

  async resendOtp(challengeId: string): Promise<AuthChallengeResponse> {
    return this.otp.resend(challengeId);
  }

  async verifyPasswordResetCode(
    challengeId: string,
    code: string,
  ): Promise<{ resetToken: string }> {
    const challenge = await this.otp.verify(challengeId, code, 'password_reset');
    return { resetToken: await this.otp.createResetGrant(challenge) };
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const passwordHash = await bcrypt.hash(password, getRuntimeSettings().PASSWORD_HASH_ROUNDS);
    const reset = await this.otp.consumeResetGrant(token);
    const user = await this.userModel.findOneAndUpdate(
      {
        _id: reset.userId,
        email: reset.email,
        tokenVersion: reset.userTokenVersion,
        disabled: { $ne: true },
        emailVerified: { $ne: false },
      },
      {
        $set: { passwordHash, trustedDeviceHashes: [] },
        $unset: { resetTokenHash: 1, resetExpiresAt: 1 },
        $inc: { tokenVersion: 1, profileVersion: 1 },
      },
      { returnDocument: 'after' },
    );
    if (!user)
      throw new BadRequestException('This reset code is invalid or expired. Request a new code.');
    await this.markSessionsRevoked(user._id.toString());
    void this.recoveryMailer
      .send(
        user.email,
        'Your KitchenToDoor password was changed',
        'Your password has been changed and all existing sessions have been signed out. If you did not make this change, contact the kitchen immediately.',
      )
      .catch(() => this.logger.warn('Password change notification could not be delivered.'));
  }

  async listCouriers(): Promise<UserSummary[]> {
    const users = await this.userModel
      .find({ role: UserRole.COURIER, disabled: { $ne: true } })
      .sort({ name: 1 });
    return users.map((user) => ({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: UserRole.COURIER,
      phone: user.phone,
    }));
  }
}
