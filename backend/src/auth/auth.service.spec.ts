import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service.js';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { UserRole } from '@kitchentodoor/shared';
import bcrypt from 'bcryptjs';
import { RecoveryMailer } from './recovery-mailer.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { AuthOtpService } from './auth-otp.service.js';

describe('AuthService Unit Tests', () => {
  let service: AuthService;
  let mockUserModel: any;
  let mockJwtService: any;

  beforeEach(() => {
    mockUserModel = {
      findOne: vi.fn<any>(),
      create: vi.fn<any>(),
      findById: vi.fn<any>(),
      updateOne: vi.fn<any>().mockResolvedValue({ modifiedCount: 1 }),
      deleteOne: vi.fn<any>().mockResolvedValue({ deletedCount: 1 }),
    };
    mockJwtService = {
      sign: vi.fn<any>().mockReturnValue('mock_jwt_token_xyz'),
      verify: vi.fn<any>(),
    };
    service = new AuthService(
      mockUserModel,
      mockJwtService,
      {
        create: vi.fn<() => Promise<unknown>>().mockResolvedValue({}),
        updateMany: vi.fn<() => Promise<unknown>>().mockResolvedValue({}),
      } as any,
      {} as RecoveryMailer,
      {} as ProfilesService,
      {
        hashDeviceId: vi.fn<AuthOtpService['hashDeviceId']>(() => 'trusted-device-hash'),
        begin: vi.fn<AuthOtpService['begin']>(async (email, purpose) => ({
          status: 'verification_required',
          purpose,
          challengeId: 'A'.repeat(43),
          email,
          expiresAt: new Date(Date.now() + 600_000).toISOString(),
          resendAvailableAt: new Date(Date.now() + 60_000).toISOString(),
        })),
        requireConfigured: vi.fn<AuthOtpService['requireConfigured']>(),
      } as unknown as AuthOtpService,
    );
  });

  it('validates user password correctly with bcrypt', async () => {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('secretPass123', salt);

    mockUserModel.findOne.mockResolvedValue({
      _id: { toString: () => 'u123' },
      email: 'chef@kitchen.com',
      passwordHash,
      name: 'Head Chef',
      role: UserRole.ADMIN,
    });

    const valid = await service.validateUser('CHEF@KITCHEN.COM', 'secretPass123');
    expect(valid).not.toBeNull();
    expect(valid?.name).toBe('Head Chef');

    const invalid = await service.validateUser('chef@kitchen.com', 'wrongpassword');
    expect(invalid).toBeNull();
  });

  it('login throws UnauthorizedException when user does not exist', async () => {
    mockUserModel.findOne.mockResolvedValue(null);

    await expect(
      service.login({
        email: 'unknown@user.com',
        password: 'password123',
        deviceId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('login issues JWT and returns user summary on valid credentials', async () => {
    const passwordHash = await bcrypt.hash('validPass123', 10);
    mockUserModel.findOne.mockResolvedValue({
      _id: { toString: () => 'u123' },
      email: 'admin@kitchen.com',
      passwordHash,
      name: 'Dispatcher',
      role: UserRole.ADMIN,
      emailVerified: true,
      trustedDeviceHashes: ['trusted-device-hash'],
      phone: '555-0199',
    });

    const result = await service.login({
      email: 'admin@kitchen.com',
      password: 'validPass123',
      deviceId: '11111111-1111-4111-8111-111111111111',
    });
    expect('accessToken' in result).toBe(true);
    if (!('accessToken' in result)) throw new Error('Expected a trusted-device session');
    expect(result.accessToken).toBe('mock_jwt_token_xyz');
    expect(result.user.email).toBe('admin@kitchen.com');
    expect(result.user.role).toBe(UserRole.ADMIN);
    expect(mockJwtService.sign).toHaveBeenCalledWith({
      sub: 'u123',
      email: 'admin@kitchen.com',
      role: UserRole.ADMIN,
      name: 'Dispatcher',
      ver: 0,
      sid: expect.stringMatching(/^[a-f\d]{24}$/),
    });
  });

  it('sends an email code before issuing a session from an unknown device', async () => {
    const passwordHash = await bcrypt.hash('validPass123', 10);
    mockUserModel.findOne.mockResolvedValue({
      _id: { toString: () => 'u123' },
      email: 'admin@kitchen.com',
      passwordHash,
      name: 'Dispatcher',
      role: UserRole.ADMIN,
      emailVerified: true,
      trustedDeviceHashes: [],
    });
    const result = await service.login({
      email: 'admin@kitchen.com',
      password: 'validPass123',
      deviceId: '11111111-1111-4111-8111-111111111111',
    });
    expect(result).toMatchObject({ status: 'verification_required', purpose: 'new_device_login' });
    expect(mockJwtService.sign).not.toHaveBeenCalled();
  });

  it('register creates a pending user and returns an email verification challenge', async () => {
    mockUserModel.findOne.mockResolvedValue(null);
    mockUserModel.create.mockImplementation((doc: any) =>
      Promise.resolve({
        _id: { toString: () => 'new_user_1' },
        ...doc,
      }),
    );

    const result = await service.register({
      name: 'Sam Customer',
      email: 'sam@delivery.com',
      password: 'mypassword123',
      role: UserRole.CUSTOMER,
      phone: '555-9876',
      address: '123 Saved Street',
    });

    expect(result).toMatchObject({
      status: 'verification_required',
      purpose: 'email_verification',
    });
    expect(mockJwtService.sign).not.toHaveBeenCalled();
    expect(mockUserModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        address: '123 Saved Street',
        emailVerified: false,
        trustedDeviceHashes: [],
      }),
    );
  });

  it('register throws ConflictException if email is already taken', async () => {
    mockUserModel.findOne.mockResolvedValue({ email: 'existing@kitchen.com' });

    await expect(
      service.register({
        name: 'Duplicate User',
        email: 'existing@kitchen.com',
        password: 'pass',
        role: UserRole.CUSTOMER,
        phone: '555-0000',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('verifyToken decodes valid token', async () => {
    mockUserModel.findById.mockResolvedValue({
      _id: 'usr_888',
      email: 'courier@kitchen.com',
      role: UserRole.COURIER,
      name: 'Fast Rider',
      tokenVersion: 0,
    });
    mockJwtService.verify.mockReturnValue({
      sub: 'usr_888',
      email: 'courier@kitchen.com',
      role: UserRole.COURIER,
      name: 'Fast Rider',
    });

    const user = await service.verifyToken('valid_token_abc');
    expect(user.id).toBe('usr_888');
    expect(user.role).toBe(UserRole.COURIER);
  });

  it('uses the current database role and rejects revoked or disabled sessions', async () => {
    mockJwtService.verify.mockReturnValue({ sub: 'u123', role: UserRole.ADMIN, ver: 0 });
    const user = {
      _id: 'u123',
      name: 'Changed role',
      email: 'u@example.com',
      role: UserRole.CUSTOMER,
    };
    mockUserModel.findById.mockResolvedValue(user);
    expect((await service.verifyToken('old-admin-token')).role).toBe(UserRole.CUSTOMER);
    mockUserModel.findById.mockResolvedValue({ ...user, tokenVersion: 1 });
    await expect(service.verifyToken('revoked-token')).rejects.toThrow(UnauthorizedException);
    mockUserModel.findById.mockResolvedValue({ ...user, disabled: true });
    await expect(service.verifyToken('disabled-token')).rejects.toThrow(UnauthorizedException);
  });

  it('revokes existing access tokens on the server', async () => {
    await service.revokeSessions('u123');
    expect(mockUserModel.updateOne).toHaveBeenCalledWith(
      { _id: 'u123' },
      { $inc: { tokenVersion: 1 } },
    );
  });

  it('verifyToken throws UnauthorizedException on invalid token', async () => {
    mockJwtService.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });

    await expect(service.verifyToken('expired_token')).rejects.toThrow(UnauthorizedException);
  });
});
