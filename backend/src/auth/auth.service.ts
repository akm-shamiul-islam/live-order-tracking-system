import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Inject,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes, createHash } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { User, UserDocument } from '../database/schemas/user.schema.js';
import { LoginDto, RegisterDto, AuthResponse, UserSummary, UserRole } from '@kitchentodoor/shared';
import { getRuntimeSettings } from '../config/runtime-settings.js';
import { AuthSession, type AuthSessionDocument } from '../database/schemas/auth-session.schema.js';
import { RecoveryMailer } from './recovery-mailer.js';

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
  ) {}

  async validateUser(email: string, pass: string): Promise<UserDocument | null> {
    const user = await this.userModel.findOne({ email: email.trim().toLowerCase() });
    if (!user || user.disabled) return null;
    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) return null;
    return user;
  }

  async login(loginDto: LoginDto): Promise<IssuedSession> {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueSession(user);
  }

  async register(registerDto: RegisterDto): Promise<IssuedSession> {
    const existing = await this.userModel.findOne({ email: registerDto.email.toLowerCase() });
    if (existing) {
      throw new ConflictException('A user with this email address already exists');
    }

    const salt = await bcrypt.genSalt(getRuntimeSettings().PASSWORD_HASH_ROUNDS);
    const passwordHash = await bcrypt.hash(registerDto.password, salt);

    let newUser: UserDocument;
    try {
      newUser = await this.userModel.create({
        name: registerDto.name,
        email: registerDto.email.toLowerCase(),
        passwordHash,
        role: UserRole.CUSTOMER,
        phone: registerDto.phone,
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000)
        throw new ConflictException('A user with this email address already exists');
      throw error;
    }

    return this.issueSession(newUser);
  }

  private summary(user: UserDocument): UserSummary {
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
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
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
    };
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
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      }))
    ) {
      throw new UnauthorizedException('Your session has expired. Please sign in again.');
    }
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
    };
  }

  async revokeSessions(userId: string): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
    await this.sessionModel.updateMany({ userId }, { $set: { revokedAt: new Date() } });
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

  async forgotPassword(email: string): Promise<void> {
    if (!getRuntimeSettings().PASSWORD_RESET_ENABLED)
      throw new ServiceUnavailableException(
        'Password recovery is temporarily unavailable. Please contact the kitchen.',
      );
    // Return the same response without awaiting account lookup or SMTP delivery.
    void this.deliverReset(email).catch(() =>
      this.logger.warn(
        'Password recovery could not be delivered. Check the configured mail service.',
      ),
    );
  }

  private async deliverReset(email: string): Promise<void> {
    const settings = getRuntimeSettings();
    const token = `reset_${randomBytes(32).toString('base64url')}`;
    const user = await this.userModel.findOneAndUpdate(
      {
        email,
        disabled: { $ne: true },
        $or: [
          { resetRequestedAt: { $exists: false } },
          { resetRequestedAt: { $lt: new Date(Date.now() - settings.PASSWORD_RESET_INTERVAL_MS) } },
        ],
      },
      {
        $set: {
          resetTokenHash: tokenHash(token),
          resetExpiresAt: new Date(Date.now() + settings.PASSWORD_RESET_TTL_MS),
          resetRequestedAt: new Date(),
        },
      },
      { returnDocument: 'after' },
    );
    if (!user) return;
    const url = new URL('/account/reset', settings.PUBLIC_APP_URL);
    url.hash = new URLSearchParams({ token }).toString();
    await this.recoveryMailer.send(
      user.email,
      'Reset your KitchenToDoor password',
      `Open this link to choose a new password:\n\n${url.toString()}\n\nThis link expires in ${Math.ceil(settings.PASSWORD_RESET_TTL_MS / 60_000)} minutes and can be used once. If you did not request it, you can ignore this email.`,
    );
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const passwordHash = await bcrypt.hash(password, getRuntimeSettings().PASSWORD_HASH_ROUNDS);
    const user = await this.userModel.findOneAndUpdate(
      {
        resetTokenHash: tokenHash(token),
        resetExpiresAt: { $gt: new Date() },
        disabled: { $ne: true },
      },
      {
        $set: { passwordHash },
        $unset: { resetTokenHash: 1, resetExpiresAt: 1 },
        $inc: { tokenVersion: 1 },
      },
      { returnDocument: 'after' },
    );
    if (!user)
      throw new BadRequestException('This reset link is invalid or expired. Request a new link.');
    await this.sessionModel.updateMany({ userId: user._id }, { $set: { revokedAt: new Date() } });
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
