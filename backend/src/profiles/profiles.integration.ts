import 'reflect-metadata';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { randomBytes, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import {
  UserRole,
  type AuthResponse,
  type NotificationPage,
  type ProfileChange,
  type ProfileResponse,
  type AuthChallengeResponse,
} from '@kitchentodoor/shared';
import { User, type UserDocument } from '../database/schemas/user.schema.js';
import {
  ProfileChangeRecord,
  type ProfileChangeDocument,
} from '../database/schemas/profile-change.schema.js';
import { createTestSmtpServer } from '../testing/test-smtp.js';

describe('Profile approval, protected photos and notification ownership', () => {
  let mongo: MongoMemoryServer;
  let app: NestFastifyApplication;
  let users: Model<UserDocument>;
  let changes: Model<ProfileChangeDocument>;
  let smtp: Awaited<ReturnType<typeof createTestSmtpServer>>;
  let admin: string;
  let photo: string;
  const password = 'Original-profile#2026!';
  const headers = (token: string) => ({ authorization: `Bearer ${token}` });
  const deviceIds = new Map<string, string>();
  beforeAll(async () => {
    smtp = await createTestSmtpServer();
    mongo = await MongoMemoryServer.create({
      binary: { downloadDir: join(tmpdir(), 'ktd-mongo-binaries') },
    });
    for (const [key, value] of Object.entries({
      NODE_ENV: 'production',
      MONGODB_URI: mongo.getUri('ktd_profiles'),
      JWT_SECRET: randomBytes(32).toString('hex'),
      RATE_LIMIT_MAX: '10000',
      LOGIN_RATE_LIMIT_MAX: '1000',
      REGISTER_RATE_LIMIT_MAX: '1000',
      OTP_REQUEST_RATE_LIMIT_MAX: '1000',
      OTP_VERIFY_RATE_LIMIT_MAX: '1000',
      PROFILE_CHANGE_RATE_LIMIT_MAX: '1000',
      PASSWORD_HASH_ROUNDS: '10',
      PROFILE_RECOVERY_INTERVAL_MS: '200',
      MONGODB_RETRY_ATTEMPTS: '0',
      DNS_SERVERS: '',
      SMTP_HOST: smtp.host,
      SMTP_PORT: String(smtp.port),
      SMTP_SECURE: 'false',
      SMTP_REQUIRE_TLS: 'false',
      SMTP_USER: smtp.user,
      SMTP_PASSWORD: smtp.password,
      SMTP_FROM: smtp.from,
    }))
      vi.stubEnv(key, value);
    const { AppModule } = await import('../app.module.js');
    app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter({ bodyLimit: 4_100_000 }),
      { logger: false },
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    users = app.get(getModelToken(User.name));
    changes = app.get(getModelToken(ProfileChangeRecord.name));
    const doc = await users.create({
      name: 'Review Admin',
      email: 'reviewer@example.test',
      role: UserRole.ADMIN,
      passwordHash: await bcrypt.hash(password, 10),
    });
    admin = app.get(JwtService).sign({ sub: doc._id.toString(), ver: 0 });
    photo = `data:image/png;base64,${(
      await sharp({ create: { width: 24, height: 24, channels: 3, background: '#0d9488' } })
        .png()
        .toBuffer()
    ).toString('base64')}`;
  });
  afterAll(async () => {
    await app?.close();
    await smtp?.close();
    await mongo?.stop();
    vi.unstubAllEnvs();
  });
  async function register(withPhoto = false): Promise<AuthResponse> {
    const email = `${randomUUID()}@example.test`;
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Original Customer',
        email,
        phone: '555-1234567',
        address: 'Original Address',
        password,
        ...(withPhoto ? { photo } : {}),
      },
    });
    expect(response.statusCode).toBe(201);
    const challenge = response.json<AuthChallengeResponse>();
    const deviceId = randomUUID();
    const code = await smtp.takeOtp(email);
    const verified = await app.inject({
      method: 'POST',
      url: '/api/auth/email/verify',
      payload: { challengeId: challenge.challengeId, code, deviceId },
    });
    expect(verified.statusCode).toBe(200);
    deviceIds.set(email, deviceId);
    return verified.json<AuthResponse>();
  }
  async function profile(token: string) {
    const response = await app.inject({ url: '/api/profile', headers: headers(token) });
    expect(response.statusCode).toBe(200);
    return response.json<ProfileResponse>();
  }
  async function request(auth: AuthResponse, extra: Record<string, unknown> = {}) {
    const current = await profile(auth.accessToken);
    return app.inject({
      method: 'PATCH',
      url: '/api/profile',
      headers: headers(auth.accessToken),
      payload: {
        name: 'Requested Name',
        phone: '555-7654321',
        address: 'Requested Address',
        expectedProfileVersion: current.user.profileVersion ?? 0,
        ...extra,
      },
    });
  }
  async function review(id: string, decision: 'APPROVE' | 'REJECT', feedback?: string) {
    return app.inject({
      method: 'POST',
      url: `/api/notifications/${id}/review`,
      headers: headers(admin),
      payload: { decision, ...(feedback ? { feedback } : {}) },
    });
  }

  it.each(['unverified', 'disabled'] as const)(
    'waits for an active account before recovering a registration photo for a %s customer',
    async (state) => {
      const email = `${randomUUID()}@example.test`;
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { name: 'Pending Photo Customer', email, phone: '555-1234567', password, photo },
      });
      expect(response.statusCode).toBe(201);
      const challenge = response.json<AuthChallengeResponse>();
      const owner = await users.findOne({ email }).select('+registrationPhotoId');
      if (!owner?.registrationPhotoId) throw new Error('Expected a registration photo');
      if (state === 'disabled')
        await users.updateOne(
          { _id: owner._id },
          { $set: { emailVerified: true, disabled: true } },
        );
      // Observe two recovery intervals before activating this account.
      await new Promise<void>((resolve) => setTimeout(resolve, 450));
      expect(await changes.countDocuments({ userId: owner._id.toString() })).toBe(0);
      expect(
        (await users.findById(owner._id).select('+registrationPhotoId'))?.registrationPhotoId,
      ).toBe(owner.registrationPhotoId);
      let activated: boolean;
      if (state === 'unverified') {
        const code = await smtp.takeOtp(email);
        const verified = await app.inject({
          method: 'POST',
          url: '/api/auth/email/verify',
          payload: { challengeId: challenge.challengeId, code, deviceId: randomUUID() },
        });
        activated = verified.statusCode === 200;
      } else {
        const enabled = await users.updateOne({ _id: owner._id }, { $set: { disabled: false } });
        activated = enabled.matchedCount === 1;
      }
      expect(activated).toBe(true);
      await vi.waitFor(
        async () => {
          expect(await changes.countDocuments({ userId: owner._id.toString() })).toBe(1);
        },
        { timeout: 2000 },
      );
    },
  );

  it('keeps registration photos pending, strips metadata and protects both pending and approved photos', async () => {
    const owner = await register(true);
    const other = await register();
    expect(owner.user.role).toBe(UserRole.CUSTOMER);
    expect(owner.user.photoId).toBeNull();
    const current = await profile(owner.accessToken);
    const change = current.pending!;
    expect(change.status).toBe('PENDING');
    expect(change.proposed.photoId).toMatch(/^[a-f\d]{24}$/);
    for (const token of [owner.accessToken, admin]) {
      const response = await app.inject({
        url: `/api/profile/photos/${change.proposed.photoId}`,
        headers: headers(token),
      });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('image/webp');
      expect(response.headers['cache-control']).toContain('no-store');
      const metadata = await sharp(response.rawPayload).metadata();
      expect(metadata.width).toBe(256);
      expect(metadata.exif).toBeUndefined();
    }
    expect(
      (
        await app.inject({
          url: `/api/profile/photos/${change.proposed.photoId}`,
          headers: headers(other.accessToken),
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ url: `/api/profile/photos/${change.proposed.photoId}` })).statusCode,
    ).toBe(401);
    expect((await review(change.id, 'APPROVE')).statusCode).toBe(201);
    expect((await profile(owner.accessToken)).user.photoId).toBe(change.proposed.photoId);
  });

  it('requires admin approval, blocks cross-account access, and delivers persistent read/unread decisions', async () => {
    const owner = await register();
    const other = await register();
    const submitted = await request(owner, { photo });
    expect(submitted.statusCode).toBe(200);
    const change = submitted.json<{ change: ProfileChange }>().change;
    expect(JSON.stringify(submitted.json())).not.toMatch(
      /passwordHash|baseTokenVersion|baseVersion|readBy|currentPassword/,
    );
    expect((await profile(owner.accessToken)).user.name).toBe('Original Customer');
    expect(
      (
        await app.inject({
          url: `/api/notifications/${change.id}`,
          headers: headers(other.accessToken),
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/notifications/${change.id}/read`,
          headers: headers(other.accessToken),
          payload: { unread: false },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/notifications/${change.id}/review`,
          headers: headers(owner.accessToken),
          payload: { decision: 'APPROVE' },
        })
      ).statusCode,
    ).toBe(403);
    const adminList = await app.inject({
      url: `/api/notifications?userId=${owner.user.id}`,
      headers: headers(admin),
    });
    expect(adminList.json<NotificationPage>().notifications[0]?.unread).toBe(true);
    expect(
      (await review(change.id, 'APPROVE')).json<{ notification: ProfileChange }>().notification
        .status,
    ).toBe('APPROVED');
    const updated = await profile(owner.accessToken);
    expect(updated.pending).toBeNull();
    expect(updated.user).toMatchObject({
      name: 'Requested Name',
      phone: '555-7654321',
      address: 'Requested Address',
      email: owner.user.email,
      role: UserRole.CUSTOMER,
    });
    const ownerList = () =>
      app.inject({ url: '/api/notifications', headers: headers(owner.accessToken) });
    expect((await ownerList()).json<NotificationPage>().unreadCount).toBe(1);
    await app.inject({
      method: 'PATCH',
      url: `/api/notifications/${change.id}/read`,
      headers: headers(owner.accessToken),
      payload: { unread: false },
    });
    expect((await ownerList()).json<NotificationPage>().unreadCount).toBe(0);
    await app.inject({
      method: 'PATCH',
      url: `/api/notifications/${change.id}/read`,
      headers: headers(owner.accessToken),
      payload: { unread: true },
    });
    expect((await ownerList()).json<NotificationPage>().unreadCount).toBe(1);
    expect((await review(change.id, 'APPROVE')).statusCode).toBe(409);
  });

  it('rejects email/role/access edits and verifies the current password before storing a password request', async () => {
    const owner = await register();
    for (const extra of [
      { email: 'changed@example.test' },
      { role: UserRole.ADMIN },
      { disabled: true },
      { password: 'New-profile#2026!', currentPassword: '' },
      { password: 'New-profile#2026!', currentPassword: 'wrong-password' },
    ])
      expect((await request(owner, extra)).statusCode).toBe(400);
    const submitted = await request(owner, {
      password: 'New-profile#2026!',
      currentPassword: password,
    });
    const change = submitted.json<{ change: ProfileChange }>().change;
    expect(change.passwordChanged).toBe(true);
    expect(JSON.stringify(submitted.json())).not.toContain('New-profile');
    const stored = await changes.findById(change.id).select('+passwordHash');
    expect(await bcrypt.compare('New-profile#2026!', stored!.passwordHash!)).toBe(true);
    expect((await review(change.id, 'APPROVE')).statusCode).toBe(201);
    expect(
      (await app.inject({ url: '/api/auth/me', headers: headers(owner.accessToken) })).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: {
            email: owner.user.email,
            password,
            deviceId: deviceIds.get(owner.user.email),
          },
        })
      ).statusCode,
    ).toBe(401);
    const newDevice = randomUUID();
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: owner.user.email,
        password: 'New-profile#2026!',
        deviceId: newDevice,
      },
    });
    expect(login.statusCode).toBe(200);
    const loginChallenge = login.json<AuthChallengeResponse>();
    expect(loginChallenge.purpose).toBe('new_device_login');
    const code = await smtp.takeOtp(owner.user.email);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/login/verify',
          payload: { challengeId: loginChallenge.challengeId, code, deviceId: newDevice },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await changes.findById(change.id).select('+passwordHash'))!.passwordHash,
    ).toBeUndefined();
  });

  it('requires rejection feedback, retains the active profile, and exposes the decision only to the owner and admins', async () => {
    const owner = await register();
    const submitted = await request(owner);
    const id = submitted.json<{ change: ProfileChange }>().change.id;
    expect((await review(id, 'REJECT')).statusCode).toBe(400);
    expect(
      (await review(id, 'REJECT', 'Please provide your complete delivery address.')).statusCode,
    ).toBe(201);
    expect((await profile(owner.accessToken)).user.name).toBe('Original Customer');
    const list = await app.inject({
      url: '/api/notifications?status=REJECTED',
      headers: headers(owner.accessToken),
    });
    expect(list.json<NotificationPage>().notifications[0]).toMatchObject({
      status: 'REJECTED',
      unread: true,
      feedback: 'Please provide your complete delivery address.',
    });
  });

  it('allows a single pending request and prevents a stale decision from overwriting newer admin edits', async () => {
    const owner = await register();
    const responses = await Promise.all([request(owner), request(owner)]);
    expect(
      responses.map((response) => response.statusCode).sort((left, right) => left - right),
    ).toEqual([200, 409]);
    const pending = (await profile(owner.accessToken)).pending!;
    await users.updateOne(
      { _id: owner.user.id },
      { $set: { name: 'Newer Admin Edit' }, $inc: { profileVersion: 1 } },
    );
    const decided = await review(pending.id, 'APPROVE');
    expect(decided.json<{ notification: ProfileChange }>().notification.status).toBe('REJECTED');
    expect((await profile(owner.accessToken)).user.name).toBe('Newer Admin Edit');
  });

  it('recovers an interrupted approval without reapplying it or incrementing the profile version twice', async () => {
    const owner = await register();
    const submitted = await request(owner);
    const change = submitted.json<{ change: ProfileChange }>().change;
    await users.updateOne(
      { _id: owner.user.id },
      {
        $set: {
          name: change.proposed.name,
          phone: change.proposed.phone,
          address: change.proposed.address,
          lastProfileChangeId: change.id,
        },
        $inc: { profileVersion: 1 },
      },
    );
    await changes.updateOne(
      { _id: change.id },
      { $set: { status: 'APPLYING', reviewedAt: new Date(), reviewedBy: 'Review Admin' } },
    );
    await vi.waitFor(
      async () => expect((await changes.findById(change.id))?.status).toBe('APPROVED'),
      { timeout: 5000 },
    );
    expect((await profile(owner.accessToken)).user.profileVersion).toBe(1);
  });

  it('rejects malformed raster bytes before account creation and disallows anonymous profile access', async () => {
    const email = `${randomUUID()}@example.test`;
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Malformed Photo',
        email,
        phone: '555-1234',
        password,
        photo: 'data:image/png;base64,YmFkLWltYWdl',
      },
    });
    expect(response.statusCode).toBe(400);
    expect(await users.exists({ email })).toBeNull();
    expect((await app.inject({ url: '/api/profile' })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/notifications' })).statusCode).toBe(401);
  });

  it('requires approval for couriers and applies an administrator’s own edits immediately', async () => {
    const courier = await register();
    await users.updateOne({ _id: courier.user.id }, { $set: { role: UserRole.COURIER } });
    const submitted = await request(courier);
    expect(submitted.statusCode).toBe(200);
    const id = submitted.json<{ change: ProfileChange }>().change.id;
    expect((await profile(courier.accessToken)).user.name).toBe('Original Customer');
    expect((await review(id, 'APPROVE')).statusCode).toBe(201);
    expect((await profile(courier.accessToken)).user).toMatchObject({
      role: UserRole.COURIER,
      name: 'Requested Name',
    });
    expect(
      (
        await app.inject({
          url: `/api/users/${courier.user.id}/history`,
          headers: headers(courier.accessToken),
        })
      ).statusCode,
    ).toBe(403);
    const current = await profile(admin);
    const changed = await app.inject({
      method: 'PATCH',
      url: '/api/profile',
      headers: headers(admin),
      payload: {
        name: 'Updated Review Admin',
        phone: '555-1234',
        address: 'Administrator Address',
        expectedProfileVersion: current.user.profileVersion ?? 0,
      },
    });
    expect(changed.statusCode).toBe(200);
    expect(changed.json<{ change: ProfileChange }>().change.status).toBe('APPROVED');
    expect((await profile(admin)).user.name).toBe('Updated Review Admin');
  });

  it.each([UserRole.CUSTOMER, UserRole.COURIER])(
    'persists independent read/dismiss state for %s and restores a new review decision to the dropdown',
    async (role) => {
      const owner = await register();
      const other = await register();
      if (role === UserRole.COURIER)
        await users.updateOne({ _id: owner.user.id }, { $set: { role } });
      const submitted = await request(owner);
      const id = submitted.json<{ change: ProfileChange }>().change.id;
      const previousTime = new Date(Date.now() - 60_000).toISOString();
      await changes.updateOne(
        { _id: id },
        { $set: { updatedAt: new Date(previousTime) } },
        { timestamps: false },
      );
      const list = async (token: string, view = 'history') => {
        const response = await app.inject({
          url: `/api/notifications?view=${view}&userId=${owner.user.id}`,
          headers: headers(token),
        });
        expect(response.statusCode).toBe(200);
        return response.json<NotificationPage>();
      };
      const mutate = (
        token: string,
        action: 'read' | 'dismiss',
        payload: Record<string, unknown>,
      ) =>
        app.inject({
          method: 'PATCH',
          url: `/api/notifications/${id}/${action}`,
          headers: headers(token),
          payload,
        });
      expect((await mutate(other.accessToken, 'dismiss', {})).statusCode).toBe(404);
      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: `/api/notifications/${id}/dismiss`,
            payload: {},
          })
        ).statusCode,
      ).toBe(401);
      expect(
        (await mutate(admin, 'read', { unread: false, expectedUpdatedAt: previousTime }))
          .statusCode,
      ).toBe(200);
      expect(
        (await mutate(owner.accessToken, 'dismiss', { expectedUpdatedAt: previousTime }))
          .statusCode,
      ).toBe(200);
      expect((await list(owner.accessToken, 'dropdown')).notifications).toHaveLength(0);
      expect((await list(owner.accessToken)).notifications[0]).toMatchObject({
        id,
        unread: false,
        updatedAt: previousTime,
      });
      expect((await list(admin, 'dropdown')).notifications[0]?.id).toBe(id);
      expect(
        (await mutate(owner.accessToken, 'read', { unread: true, expectedUpdatedAt: previousTime }))
          .statusCode,
      ).toBe(200);
      expect((await list(owner.accessToken, 'dropdown')).notifications[0]?.unread).toBe(true);
      expect(
        (await mutate(owner.accessToken, 'dismiss', { expectedUpdatedAt: previousTime }))
          .statusCode,
      ).toBe(200);
      const reviewed = (await review(id, 'APPROVE')).json<{ notification: ProfileChange }>()
        .notification;
      expect(reviewed.reviewedByEmail).toBe('reviewer@example.test');
      expect((await list(owner.accessToken, 'dropdown')).notifications[0]).toMatchObject({
        id,
        status: 'APPROVED',
        unread: true,
      });
      for (const action of ['read', 'dismiss'] as const)
        expect(
          (
            await mutate(owner.accessToken, action, {
              ...(action === 'read' ? { unread: false } : {}),
              expectedUpdatedAt: previousTime,
            })
          ).statusCode,
        ).toBe(409);
      expect((await list(owner.accessToken)).notifications[0]?.unread).toBe(true);
      expect(
        (
          await mutate(owner.accessToken, 'read', {
            unread: false,
            expectedUpdatedAt: reviewed.updatedAt,
          })
        ).statusCode,
      ).toBe(200);
      const saved = await list(owner.accessToken);
      expect(saved.notifications[0]).toMatchObject({
        unread: false,
        updatedAt: reviewed.updatedAt,
      });
      expect(saved.unreadCount).toBe(0);
      expect(JSON.stringify(saved)).not.toMatch(/readBy|dismissedBy|reviewedById|passwordHash/);
    },
  );

  it('searches literal notification text within account scope and keeps the newest event first', async () => {
    const first = await register();
    const second = await register();
    const a = (await request(first, { name: 'Notification Search .* [A]' })).json<{
      change: ProfileChange;
    }>().change;
    const b = (await request(second, { name: 'Notification Search .* [B]' })).json<{
      change: ProfileChange;
    }>().change;
    await changes.updateOne(
      { _id: a.id },
      { $set: { updatedAt: new Date('2000-01-01T00:00:00.000Z') } },
      { timestamps: false },
    );
    await changes.updateOne(
      { _id: b.id },
      { $set: { updatedAt: new Date('2001-01-01T00:00:00.000Z') } },
      { timestamps: false },
    );
    const search = async (token: string, q: string, suffix = '') =>
      app.inject({
        url: `/api/notifications?q=${encodeURIComponent(q)}${suffix}`,
        headers: headers(token),
      });
    expect(
      (await search(admin, 'Notification Search .*'))
        .json<NotificationPage>()
        .notifications.map((row) => row.id),
    ).toEqual([b.id, a.id]);
    expect(
      (await search(admin, '.* [A]')).json<NotificationPage>().notifications.map((row) => row.id),
    ).toEqual([a.id]);
    expect(
      (await search(first.accessToken, '.* [B]')).json<NotificationPage>().notifications,
    ).toHaveLength(0);
    expect((await search(first.accessToken, '', `&userId=${second.user.id}`)).statusCode).toBe(403);
    expect((await search(admin, 'x'.repeat(101))).statusCode).toBe(400);
    await app.inject({
      method: 'PATCH',
      url: `/api/notifications/${a.id}/read`,
      headers: headers(admin),
      payload: { unread: false },
    });
    expect(
      (await search(admin, 'Notification Search .*'))
        .json<NotificationPage>()
        .notifications.map((row) => row.id),
    ).toEqual([b.id, a.id]);
    await review(a.id, 'REJECT', 'Please correct your Notification Search address.');
    const searched = (
      await search(admin, 'Notification Search', '&status=REJECTED')
    ).json<NotificationPage>();
    expect(searched.notifications.map((row) => row.id)).toEqual([a.id]);
    expect(searched.notifications[0]?.reviewedByEmail).toBe('reviewer@example.test');
    expect(
      (await search(admin, 'Notification Search .*'))
        .json<NotificationPage>()
        .notifications.map((row) => row.id),
    ).toEqual([a.id, b.id]);
    expect(
      (await search(second.accessToken, 'reviewer@example.test')).json<NotificationPage>()
        .notifications,
    ).toHaveLength(0);
  });
});
