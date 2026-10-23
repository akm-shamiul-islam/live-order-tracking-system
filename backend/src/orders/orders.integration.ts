import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { io, type Socket } from 'socket.io-client';
import {
  UserRole,
  OrderStatus,
  type CreateOrderDto,
  type OrderDetails,
  type UserSummary,
  type AuthChallengeResponse,
} from '@kitchentodoor/shared';
import { OrdersService } from './orders.service.js';
import { OrdersGateway } from './orders.gateway.js';
import { User, type UserDocument } from '../database/schemas/user.schema.js';
import { Order, type OrderDocument } from '../database/schemas/order.schema.js';
import { BoundedSocketAdapter } from '../common/socket-adapter.js';
import { RecoveryMailer } from '../auth/recovery-mailer.js';
import { AuthOtpService } from '../auth/auth-otp.service.js';
import { AuthSession } from '../database/schemas/auth-session.schema.js';
import { AuthChallenge } from '../database/schemas/auth-challenge.schema.js';
import bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service.js';
import { createTestSmtpServer } from '../testing/test-smtp.js';

describe('Real MongoDB, HTTP and Socket.IO authorization and consistency', () => {
  let mongo: MongoMemoryServer;
  let app: NestFastifyApplication;
  let orders: OrdersService;
  let userModel: Model<UserDocument>;
  let orderModel: Model<OrderDocument>;
  let base: string;
  let smtp: Awaited<ReturnType<typeof createTestSmtpServer>>;
  let directInject: NestFastifyApplication['inject'];
  const sockets: Socket[] = [];
  const actors = new Map<string, UserSummary>();
  const tokens = new Map<string, string>();
  const mail = vi.fn<RecoveryMailer['send']>().mockResolvedValue(undefined);
  const dto: CreateOrderDto = {
    customer: { name: 'Synthetic Customer', phone: '555-1234', address: '123 Test Street' },
    deliveryAddress: '123 Test Street',
    items: [{ itemId: 'item-1', name: 'Synthetic item', price: 1, quantity: 1 }],
  };

  beforeAll(async () => {
    smtp = await createTestSmtpServer();
    mongo = await MongoMemoryServer.create({
      binary: { downloadDir: join(tmpdir(), 'ktd-mongo-binaries') },
    });
    for (const [key, value] of Object.entries({
      NODE_ENV: 'production',
      MONGODB_URI: mongo.getUri('ktd_integration'),
      JWT_SECRET: randomBytes(32).toString('hex'),
      DNS_SERVERS: '',
      MONGODB_SERVER_SELECTION_TIMEOUT_MS: '1000',
      MONGODB_RETRY_ATTEMPTS: '0',
      RATE_LIMIT_MAX: '10000',
      SOCKET_RATE_LIMIT_MAX: '20',
      REGISTER_RATE_LIMIT_MAX: '1000',
      OTP_REQUEST_RATE_LIMIT_MAX: '1000',
      OTP_VERIFY_RATE_LIMIT_MAX: '1000',
      LOGIN_RATE_LIMIT_MAX: '1000',
      RESET_RATE_LIMIT_MAX: '1000',
      SOCKET_IP_RATE_LIMIT_MAX: '500',
      SOCKET_RATE_LIMIT_WINDOW_MS: '1000',
      AUTH_COOKIE_SECURE: 'false',
      PASSWORD_HASH_ROUNDS: '10',
      SMTP_HOST: smtp.host,
      SMTP_PORT: String(smtp.port),
      SMTP_SECURE: 'false',
      SMTP_REQUIRE_TLS: 'false',
      SMTP_USER: smtp.user,
      SMTP_PASSWORD: smtp.password,
      SMTP_FROM: smtp.from,
      AUTH_OTP_TTL_SECONDS: '600',
      AUTH_OTP_RESEND_SECONDS: '60',
      PUBLIC_APP_URL: 'https://kitchen.example.test',
      FRONTEND_URL: 'http://localhost:5173,https://kitchen.example.test',
      MONGODB_HEARTBEAT_FREQUENCY_MS: '500',
    }))
      vi.stubEnv(key, value);
    // ConfigModule reads the isolated settings when the application module is evaluated.
    const { AppModule } = await import('../app.module.js');
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
      logger: false,
    });
    app.useWebSocketAdapter(new BoundedSocketAdapter(app));
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
    const rawInject = app.inject.bind(app);
    directInject = rawInject;
    const deviceIds = new Map<string, string>();
    const injected = async (input: unknown) => {
      const options =
        input && typeof input === 'object'
          ? (input as { method?: string; url?: string; payload?: unknown; headers?: object })
          : {};
      let payload = options.payload;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload) as unknown;
        } catch {
          payload = undefined;
        }
      }
      const body =
        payload && typeof payload === 'object' && !Array.isArray(payload)
          ? (payload as Record<string, unknown>)
          : undefined;
      const path = typeof options.url === 'string' ? options.url : '';
      let request = input as Parameters<typeof app.inject>[0];
      let loginDeviceId: string | undefined;
      if (options.method === 'POST' && path === '/api/auth/login' && body) {
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        loginDeviceId =
          typeof body.deviceId === 'string' ? body.deviceId : deviceIds.get(email) || randomUUID();
        request = {
          ...options,
          payload: { ...body, deviceId: loginDeviceId },
        } as Parameters<typeof app.inject>[0];
        if (email) deviceIds.set(email, loginDeviceId);
      }
      const response = await rawInject(request);
      if (
        options.method === 'POST' &&
        path === '/api/auth/register' &&
        response.statusCode === 201 &&
        body &&
        typeof body.email === 'string'
      ) {
        const challenge = response.json<AuthChallengeResponse>();
        const deviceId = randomUUID();
        const code = await smtp.takeOtp(body.email);
        const verified = await rawInject({
          method: 'POST',
          url: '/api/auth/email/verify',
          payload: { challengeId: challenge.challengeId, code, deviceId },
        });
        if (verified.statusCode !== 200)
          throw new Error(
            `Test email verification failed: ${verified.statusCode} ${verified.body}`,
          );
        deviceIds.set(body.email.trim().toLowerCase(), deviceId);
        return new Proxy(verified, {
          get(target, property) {
            if (property === 'statusCode') return 201;
            const value = Reflect.get(target, property, target);
            return typeof value === 'function' ? value.bind(target) : value;
          },
        }) as typeof verified;
      }
      if (
        options.method === 'POST' &&
        path === '/api/auth/login' &&
        response.statusCode === 200 &&
        loginDeviceId
      ) {
        const result = response.json<{ status?: string; challengeId?: string }>();
        if (result.status === 'verification_required' && result.challengeId) {
          const email = body && typeof body.email === 'string' ? body.email : '';
          const code = await smtp.takeOtp(email);
          return rawInject({
            method: 'POST',
            url: '/api/auth/login/verify',
            payload: { challengeId: result.challengeId, code, deviceId: loginDeviceId },
          });
        }
      }
      return response;
    };
    Object.defineProperty(app, 'inject', { configurable: true, value: injected });
    orders = app.get(OrdersService);
    userModel = app.get(getModelToken(User.name));
    orderModel = app.get(getModelToken(Order.name));
    vi.spyOn(app.get(RecoveryMailer), 'send').mockImplementation(mail);
    await Promise.all([
      userModel.init(),
      orderModel.init(),
      app.get<Model<unknown>>(getModelToken(AuthSession.name)).init(),
    ]);
    const passwordHash = await bcrypt.hash('Test-password123!', 10);
    for (const [name, role] of [
      ['admin', UserRole.ADMIN],
      ['courier1', UserRole.COURIER],
      ['courier2', UserRole.COURIER],
      ['customer1', UserRole.CUSTOMER],
      ['customer2', UserRole.CUSTOMER],
    ] as const) {
      const doc = await userModel.create({
        name,
        email: `${name}@example.test`,
        passwordHash,
        role,
      });
      const actor: UserSummary = { id: doc._id.toString(), name, email: doc.email, role };
      actors.set(name, actor);
      tokens.set(name, app.get(JwtService).sign({ sub: actor.id, ver: 0 }));
    }
  });

  afterAll(async () => {
    for (const socket of sockets) socket.disconnect();
    await app?.close();
    await smtp?.close();
    await mongo?.stop();
    vi.unstubAllEnvs();
  });

  const actor = (name: string) => actors.get(name)!;
  const auth = (name: string) => ({ authorization: `Bearer ${tokens.get(name)}` });
  async function socket(name?: string) {
    const client = io(base, {
      transports: ['websocket'],
      reconnection: false,
      auth: name ? { token: tokens.get(name) } : {},
    });
    sockets.push(client);
    await new Promise<void>((resolve, reject) => {
      client.once(name ? 'authenticated' : 'connect', () => resolve());
      client.once('connect_error', reject);
    });
    return client;
  }
  const ack = (client: Socket, event: string, payload?: unknown) =>
    client
      .timeout(3000)
      .emitWithAck(event, ...(payload === undefined ? [] : [payload])) as Promise<{
      ok: boolean;
      error?: string;
    }>;
  async function create(owner?: string): Promise<OrderDetails> {
    return orders.createOrder(dto, owner ? actor(owner).id : undefined);
  }
  async function issueResetGrant(email: string): Promise<string> {
    const requested = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { email },
    });
    expect(requested.statusCode).toBe(200);
    const challenge = requested.json<AuthChallengeResponse>();
    const code = await smtp.takeOtp(email);
    const verified = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password/verify',
      payload: { challengeId: challenge.challengeId, code },
    });
    expect(verified.statusCode).toBe(200);
    return verified.json<{ resetToken: string }>().resetToken;
  }

  it('persists an owned language preference through registration, login and refresh without exposing account edits', async () => {
    const email = `language-${randomUUID()}@example.test`;
    const password = 'Language-Test#2026!';
    const registration = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Language Customer', email, password, phone: '555-1234567', language: 'ja' },
    });
    expect(registration.statusCode).toBe(201);
    const registered = registration.json<{ accessToken: string; user: UserSummary }>();
    expect(registered.user).toMatchObject({
      role: UserRole.CUSTOMER,
      language: 'ja',
      languageVersion: 0,
    });
    const headers = { authorization: `Bearer ${registered.accessToken}` };
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: '/api/auth/preferences',
          payload: { language: 'en' },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: '/api/auth/preferences',
          headers,
          payload: { language: 'fr' },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: '/api/auth/preferences',
          headers,
          payload: { language: 'en', role: 'ADMIN', id: actor('customer2').id },
        })
      ).statusCode,
    ).toBe(400);
    const update = await app.inject({
      method: 'PATCH',
      url: '/api/auth/preferences',
      headers,
      payload: { language: 'en' },
    });
    expect(update.statusCode).toBe(200);
    expect(update.json()).toEqual({ language: 'en', languageVersion: 1 });
    expect((await app.inject({ url: '/api/auth/me', headers })).json()).toMatchObject({
      language: 'en',
      languageVersion: 1,
      role: UserRole.CUSTOMER,
    });
    expect((await userModel.findById(actor('customer2').id))?.languageVersion).toBe(0);
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json<{ user: UserSummary }>().user).toMatchObject({
      language: 'en',
      languageVersion: 1,
    });
    const setCookie = login.headers['set-cookie'];
    const cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie)?.split(';')[0] ?? '';
    const refreshed = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { cookie, origin: 'http://localhost:5173' },
    });
    expect(refreshed.statusCode).toBe(200);
    expect(refreshed.json<{ user: UserSummary }>().user).toMatchObject({
      language: 'en',
      languageVersion: 1,
    });
  });

  it('requires email verification at registration and a code for each new device', async () => {
    const raw = directInject!;
    const email = `otp-${randomUUID()}@example.test`;
    const password = 'OTP-customer#2026!';
    const firstDevice = randomUUID();
    const registration = await raw({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'OTP Customer', email, phone: '555-1234567', password },
    });
    expect(registration.statusCode).toBe(201);
    const registrationChallenge = registration.json<AuthChallengeResponse>();
    expect(registrationChallenge).toMatchObject({
      status: 'verification_required',
      purpose: 'email_verification',
      email,
    });
    expect(await userModel.findOne({ email }).select('emailVerified')).toMatchObject({
      emailVerified: false,
    });
    const blocked = await raw({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password, deviceId: firstDevice },
    });
    expect(blocked.statusCode).toBe(401);
    const registrationCode = await smtp.takeOtp(email);
    const challengeRecord = await app
      .get<Model<{ codeHash: string }>>(getModelToken(AuthChallenge.name))
      .findById(registrationChallenge.challengeId)
      .select('+codeHash');
    expect(challengeRecord?.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(challengeRecord?.codeHash).not.toContain(registrationCode);
    const activated = await raw({
      method: 'POST',
      url: '/api/auth/email/verify',
      payload: {
        challengeId: registrationChallenge.challengeId,
        code: registrationCode,
        deviceId: firstDevice,
      },
    });
    expect(activated.statusCode).toBe(200);
    expect(activated.json<{ user: UserSummary }>().user.email).toBe(email);
    expect(await userModel.findOne({ email }).select('emailVerified')).toMatchObject({
      emailVerified: true,
    });

    const newDevice = randomUUID();
    const login = await raw({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password, deviceId: newDevice },
    });
    expect(login.statusCode).toBe(200);
    const loginChallenge = login.json<AuthChallengeResponse>();
    expect(loginChallenge).toMatchObject({
      status: 'verification_required',
      purpose: 'new_device_login',
    });
    const loginCode = await smtp.takeOtp(email);
    const wrongDevice = await raw({
      method: 'POST',
      url: '/api/auth/login/verify',
      payload: {
        challengeId: loginChallenge.challengeId,
        code: loginCode,
        deviceId: firstDevice,
      },
    });
    expect(wrongDevice.statusCode).toBe(400);
    const verifiedLogin = await raw({
      method: 'POST',
      url: '/api/auth/login/verify',
      payload: {
        challengeId: loginChallenge.challengeId,
        code: loginCode,
        deviceId: newDevice,
      },
    });
    expect(verifiedLogin.statusCode).toBe(200);
    expect(verifiedLogin.json<{ user: UserSummary }>().user.email).toBe(email);
    const trustedAfterVerification = await userModel
      .findOne({ email })
      .select('+trustedDeviceHashes')
      .lean();
    expect(trustedAfterVerification?.trustedDeviceHashes).toContain(
      app.get(AuthOtpService).hashDeviceId(newDevice),
    );

    const logout = await raw({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        authorization: `Bearer ${verifiedLogin.json<{ accessToken: string }>().accessToken}`,
      },
    });
    expect(logout.statusCode).toBe(200);
    const trustedDeviceLogin = await raw({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password, deviceId: newDevice },
    });
    expect(trustedDeviceLogin.statusCode).toBe(200);
    expect(trustedDeviceLogin.json()).toHaveProperty('accessToken');
  });

  it('requires sign-in and protects order identifiers and tracking links by account ownership', async () => {
    const order = await create('customer1');
    expect(order.trackingId).toMatch(/^trk_[\w-]{43}$/);
    const stored = await orderModel.findById(order.id).select('+trackingTokenHash').lean();
    expect(stored?.trackingTokenHash).toHaveLength(64);
    expect(JSON.stringify(stored)).not.toContain(order.trackingId);
    for (const id of [order.id, order.orderNumber]) {
      expect((await app.inject({ url: `/api/orders/${id}` })).statusCode).toBe(401);
      expect(
        (await app.inject({ url: `/api/orders/${id}`, headers: auth('customer2') })).statusCode,
      ).toBe(404);
      expect(
        (await app.inject({ url: `/api/orders/${id}`, headers: auth('customer1') })).statusCode,
      ).toBe(200);
    }
    expect((await app.inject({ url: `/api/orders/${order.trackingId}` })).statusCode).toBe(401);
    expect(
      (await app.inject({ url: `/api/orders/${order.trackingId}`, headers: auth('customer2') }))
        .statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ url: `/api/orders/${order.trackingId}`, headers: auth('customer1') }))
        .statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ method: 'POST', url: '/api/orders', payload: dto })).statusCode,
    ).toBe(401);
    expect((await app.inject({ url: '/api/orders/my-orders?phone=555-1234' })).statusCode).toBe(
      401,
    );
    const history = await app.inject({
      url: '/api/orders/my-orders?phone=555-1234',
      headers: auth('customer2'),
    });
    expect(history.json().orders).toEqual([]);
    const guest = await socket();
    expect((await ack(guest, 'order:join', { orderId: order.orderNumber })).ok).toBe(false);
    expect((await ack(guest, 'order:join', { orderId: order.trackingId })).ok).toBe(false);
    guest.disconnect();
    const owner = await socket('customer1');
    expect((await ack(owner, 'order:join', { orderId: order.trackingId })).ok).toBe(true);
    owner.disconnect();
  });

  it('downloads PDF receipts only for the owner or an administrator', async () => {
    const order = await create('customer1');
    const receiptUrl = `/api/orders/${order.id}/receipt?language=ja`;
    const ownerReceipt = await app.inject({ url: receiptUrl, headers: auth('customer1') });
    expect(ownerReceipt.statusCode).toBe(200);
    expect(ownerReceipt.headers['content-type']).toBe('application/pdf');
    expect(ownerReceipt.headers['content-disposition']).toContain(order.orderNumber);
    expect(ownerReceipt.payload.startsWith('%PDF-')).toBe(true);
    expect(ownerReceipt.rawPayload.toString('latin1')).toMatch(/\/Subtype\s*\/Image/);
    expect(ownerReceipt.headers['cache-control']).toBe('no-store');

    expect((await app.inject({ url: receiptUrl })).statusCode).toBe(401);
    expect((await app.inject({ url: receiptUrl, headers: auth('customer2') })).statusCode).toBe(
      404,
    );
    expect(
      (
        await app.inject({
          url: `/api/orders/${order.trackingId}/receipt?language=ja`,
          headers: auth('customer2'),
        })
      ).statusCode,
    ).toBe(404);
    expect((await app.inject({ url: receiptUrl, headers: auth('courier1') })).statusCode).toBe(403);
    expect(
      (
        await app.inject({
          url: `/api/orders/${order.id}/receipt?language=fr`,
          headers: auth('customer1'),
        })
      ).statusCode,
    ).toBe(400);
    expect((await app.inject({ url: receiptUrl, headers: auth('admin') })).statusCode).toBe(200);
  });

  it('stores exactly one audit entry when status updates race', async () => {
    const order = await create();
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () =>
        orders.updateOrderStatus(order.id, OrderStatus.CONFIRMED, undefined, {
          userId: actor('admin').id,
          role: UserRole.ADMIN,
          name: 'admin',
        }),
      ),
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const stored = await orderModel.findById(order.id).lean();
    expect(stored?.status).toBe(OrderStatus.CONFIRMED);
    expect(stored?.auditTrail?.map((log) => log.status)).toEqual([
      OrderStatus.PLACED,
      OrderStatus.CONFIRMED,
    ]);
    expect((await orders.getOrderById(order.id, actor('admin'))).statusHistory).toHaveLength(2);
    expect((await orders.getOrderById(order.id, actor('admin'))).revision).toBe(1);
  });

  it('handles simultaneous registrations with the same email as a readable conflict', async () => {
    const payload = {
      name: 'Concurrent Customer',
      email: 'concurrent@example.test',
      phone: '555-1234',
      password: 'Concurrent-password123!',
    };
    const responses = await Promise.all(
      Array.from({ length: 2 }, () =>
        app.inject({ method: 'POST', url: '/api/auth/register', payload }),
      ),
    );
    expect(responses.map((response) => response.statusCode).sort((a, b) => a - b)).toEqual([
      201, 409,
    ]);
    expect(await userModel.countDocuments({ email: payload.email })).toBe(1);
  });

  it('persists registration addresses through login and refresh while checkout edits apply only to the order', async () => {
    const savedAddress = '45 Registration Avenue, Apt 2\nTest City 10001';
    const payload = {
      name: 'Address Customer',
      email: 'address-customer@example.test',
      phone: '555-1234567',
      password: 'Address-password123!',
      address: `  ${savedAddress}\n `,
    };
    const registered = await app.inject({ method: 'POST', url: '/api/auth/register', payload });
    expect(registered.statusCode).toBe(201);
    expect(registered.json().user).toMatchObject({
      address: savedAddress,
      role: UserRole.CUSTOMER,
    });
    const registeredHeaders = { authorization: `Bearer ${registered.json().accessToken}` };
    expect(
      (await app.inject({ url: '/api/auth/me', headers: registeredHeaders })).json().address,
    ).toBe(savedAddress);
    const loggedIn = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: payload.email, password: payload.password },
    });
    expect(loggedIn.statusCode).toBe(200);
    expect(loggedIn.json().user.address).toBe(savedAddress);
    const refreshed = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { cookie: String(loggedIn.headers['set-cookie']).split(';')[0]! },
    });
    expect(refreshed.statusCode).toBe(200);
    expect(refreshed.json().user.address).toBe(savedAddress);
    const headers = { authorization: `Bearer ${refreshed.json().accessToken}` };
    const delivery = {
      name: 'Delivery Recipient',
      phone: '555-7654321',
      address: '99 Edited Delivery Street\nTest City 20002',
    };
    const created = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers,
      payload: { ...dto, customer: delivery, deliveryAddress: delivery.address },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().order.customer).toEqual(delivery);
    const storedOrder = await orderModel.findById(created.json().order.id).lean();
    expect(storedOrder?.customer.address).toBe(delivery.address);
    const storedUser = await userModel.findById(registered.json().user.id).lean();
    expect(storedUser).toMatchObject({
      name: payload.name,
      phone: payload.phone,
      address: savedAddress,
    });
    const profile = await app.inject({ url: '/api/auth/me', headers });
    expect(profile.json()).toMatchObject({
      name: payload.name,
      phone: payload.phone,
      address: savedAddress,
    });
    const available = await app.inject({ url: '/api/orders/available', headers: auth('courier1') });
    expect(available.statusCode).toBe(200);
    expect(available.body).not.toContain(savedAddress);
    expect(available.body).not.toContain('Edited Delivery Street');
  });

  it('rejects invalid optional registration addresses before creating an account', async () => {
    const email = 'invalid-address@example.test';
    for (const address of ['1234', 'a'.repeat(501), '😀'.repeat(251)]) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          name: 'Invalid Address Customer',
          email,
          phone: '555-1234567',
          password: 'Address-password123!',
          address,
        },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().errors).toEqual([
        expect.objectContaining({ field: 'address', message: expect.any(String) }),
      ]);
    }
    expect(await userModel.exists({ email })).toBeNull();
  });

  it('creates one order for concurrent checkout retries and scopes retry keys to the customer', async () => {
    const key = randomUUID();
    const headers = { ...auth('customer1'), 'idempotency-key': key };
    const before = await orderModel.countDocuments();
    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        app.inject({
          method: 'POST',
          url: '/api/orders',
          headers,
          payload: dto,
        }),
      ),
    );
    expect(responses.map((response) => response.statusCode)).toEqual(Array(8).fill(201));
    const ids = new Set(responses.map((response) => response.json().order.id));
    expect(ids.size).toBe(1);
    expect(await orderModel.countDocuments()).toBe(before + 1);
    const replay = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers,
      payload: {
        ...dto,
        items: dto.items.map((item) => ({ ...item, price: 0.01, name: 'Ignored' })),
      },
    });
    expect(replay.statusCode).toBe(201);
    expect(ids.has(replay.json().order.id)).toBe(true);
    expect(replay.body).not.toMatch(/checkoutKey|checkoutRequestHash/);
    const changed = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers,
      payload: { ...dto, deliveryAddress: 'Different test address' },
    });
    expect(changed.statusCode).toBe(409);
    const otherCustomer = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { ...auth('customer2'), 'idempotency-key': key },
      payload: dto,
    });
    expect(otherCustomer.statusCode).toBe(201);
    expect(ids.has(otherCustomer.json().order.id)).toBe(false);
    expect(await orderModel.countDocuments()).toBe(before + 2);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/orders',
          headers: { ...auth('customer1'), 'idempotency-key': 'invalid-key' },
          payload: dto,
        })
      ).statusCode,
    ).toBe(400);
  });

  it('rejects a WebSocket upgrade from an unapproved browser origin', async () => {
    const client = io(base, {
      transports: ['websocket'],
      reconnection: false,
      extraHeaders: { Origin: 'https://untrusted.example.test' },
    });
    sockets.push(client);
    await new Promise<void>((resolve, reject) => {
      client.once('connect_error', () => resolve());
      client.once('connect', () => reject(new Error('Unapproved Origin was accepted')));
    });
    expect(client.connected).toBe(false);
    client.disconnect();
  });

  it('closes oversized packets before invoking an order handler', async () => {
    const client = await socket();
    const disconnected = new Promise<void>((resolve) => client.once('disconnect', () => resolve()));
    client.emit('ping', 'x'.repeat(20_000));
    await disconnected;
    expect(client.connected).toBe(false);
  });

  it('requires administrator assignment and rejects other couriers and stale telemetry', async () => {
    const order = await create();
    await orderModel.updateOne(
      { _id: order.id },
      { $set: { status: OrderStatus.READY_FOR_PICKUP } },
    );
    await expect(
      orders.assignCourier(order.id, actor('courier1').id, actor('courier1')),
    ).rejects.toThrow('administrator');
    const claims = await Promise.allSettled(
      ['courier1', 'courier2'].map((name) =>
        orders.assignCourier(order.id, actor(name).id, actor('admin')),
      ),
    );
    expect(claims.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const winner = claims[0]!.status === 'fulfilled' ? 'courier1' : 'courier2';
    const loser = winner === 'courier1' ? 'courier2' : 'courier1';
    await expect(
      orders.updateOrderStatus(order.id, OrderStatus.OUT_FOR_DELIVERY, undefined, {
        userId: actor(loser).id,
        role: UserRole.COURIER,
        name: loser,
      }),
    ).rejects.toThrow('assigned');
    await orders.updateOrderStatus(order.id, OrderStatus.OUT_FOR_DELIVERY, undefined, {
      userId: actor(winner).id,
      role: UserRole.COURIER,
      name: winner,
    });
    await expect(orders.updateCourierCoordinates(order.id, 40, -74, actor(loser))).rejects.toThrow(
      'assigned',
    );
    await expect(
      orders.updateCourierCoordinates(
        order.id,
        40,
        -74,
        actor(winner),
        new Date(Date.now() - 60_000).toISOString(),
      ),
    ).rejects.toThrow('out of date');
    await expect(
      orders.updateCourierCoordinates(
        order.id,
        40,
        -74,
        actor(winner),
        new Date(Date.now() + 60_000).toISOString(),
      ),
    ).rejects.toThrow('out of date');
    const now = new Date(Date.now() + 5).toISOString();
    expect(
      await orders.updateCourierCoordinates(order.orderNumber, 40, -74, actor(winner), now),
    ).toBe(order.id);
    await expect(
      orders.updateCourierCoordinates(order.id, 40, -74, actor(winner), now),
    ).rejects.toThrow('newer location');
  });

  it('registers customers, scopes their orders independently of phone, and shows new orders to dispatch', async () => {
    const payload = {
      name: 'New Customer',
      email: 'new-customer@example.test',
      phone: '555-1234',
      password: 'New-customer-password123!',
    };
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/register',
          payload: { ...payload, role: UserRole.ADMIN },
        })
      ).statusCode,
    ).toBe(400);
    const registered = await app.inject({ method: 'POST', url: '/api/auth/register', payload });
    expect(registered.statusCode).toBe(201);
    expect(registered.json().user.role).toBe(UserRole.CUSTOMER);
    const headers = { authorization: `Bearer ${registered.json().accessToken}` };
    const dispatch = await socket('admin');
    let received: OrderDetails | undefined;
    dispatch.on('order:created', (event: { order: OrderDetails }) => {
      received = event.order;
    });
    const created = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: { ...dto, customer: { ...dto.customer, userId: actor('customer2').id } },
      headers,
    });
    expect(created.statusCode).toBe(201);
    const order = created.json().order as OrderDetails;
    await vi.waitFor(() => expect(received?.id).toBe(order.id));
    expect(received?.trackingId).toBeUndefined();
    expect((await orderModel.findById(order.id))?.customer.userId?.toString()).toBe(
      registered.json().user.id,
    );
    const history = await app.inject({ url: '/api/orders/my-orders?page=1&limit=10', headers });
    expect(history.json().orders.map((entry: OrderDetails) => entry.id)).toEqual([order.id]);
    const other = await app.inject({
      url: '/api/orders/my-orders?phone=555-1234&page=1&limit=100',
      headers: auth('customer2'),
    });
    expect(other.json().orders.some((entry: OrderDetails) => entry.id === order.id)).toBe(false);
    expect(
      (await app.inject({ url: `/api/orders/${order.trackingId}`, headers: auth('customer2') }))
        .statusCode,
    ).toBe(404);
    expect((await app.inject({ url: `/api/orders/${order.id}`, headers })).statusCode).toBe(200);
    for (const url of ['/api/orders', '/api/orders/available', '/api/users'])
      expect((await app.inject({ url, headers })).statusCode).toBe(403);
    dispatch.disconnect();
  });

  it('approves one delivery request under contention and removes it from every other courier’s access', async () => {
    const order = await create('customer1');
    for (const name of ['courier1', 'courier2']) {
      const available = await app.inject({
        url: '/api/orders/available?page=1&limit=100',
        headers: auth(name),
      });
      const summary = available
        .json()
        .orders.find((entry: { id: string }) => entry.id === order.id);
      expect(summary).toBeDefined();
      expect(summary).not.toHaveProperty('customer');
      expect(summary).not.toHaveProperty('deliveryCoordinates');
      expect(
        (await app.inject({ url: `/api/orders/${order.id}`, headers: auth(name) })).statusCode,
      ).toBe(404);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/orders/${order.id}/delivery-requests`,
            headers: auth(name),
          })
        ).statusCode,
      ).toBe(201);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/orders/${order.id}/delivery-requests`,
            headers: auth(name),
          })
        ).statusCode,
      ).toBe(409);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/orders/${order.id}/courier`,
            headers: auth(name),
            payload: { courierId: actor(name).id },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: `/api/orders/${order.id}/status`,
            headers: auth(name),
            payload: { status: OrderStatus.CONFIRMED },
          })
        ).statusCode,
      ).toBe(403);
    }
    const pending = await app.inject({ url: `/api/orders/${order.id}`, headers: auth('admin') });
    expect(pending.json().order.deliveryRequests).toHaveLength(2);
    const approved = await Promise.all(
      ['courier1', 'courier2'].map((name) =>
        app.inject({
          method: 'POST',
          url: `/api/orders/${order.id}/delivery-requests/${actor(name).id}`,
          payload: { decision: 'APPROVE' },
          headers: auth('admin'),
        }),
      ),
    );
    expect(approved.map((entry) => entry.statusCode).sort((a, b) => a - b)).toEqual([201, 409]);
    const assigned = await orderModel.findById(order.id);
    const winner =
      assigned?.courierId?.toString() === actor('courier1').id ? 'courier1' : 'courier2';
    const loser = winner === 'courier1' ? 'courier2' : 'courier1';
    for (const name of [winner, loser]) {
      const available = await app.inject({
        url: '/api/orders/available?limit=100',
        headers: auth(name),
      });
      expect(available.json().orders.some((entry: { id: string }) => entry.id === order.id)).toBe(
        false,
      );
      const mine = await app.inject({
        url: '/api/orders/my-orders?limit=100',
        headers: auth(name),
      });
      expect(mine.json().orders.some((entry: { id: string }) => entry.id === order.id)).toBe(
        name === winner,
      );
    }
    expect(
      (await app.inject({ url: `/api/orders/${order.id}`, headers: auth(loser) })).statusCode,
    ).toBe(404);
    const otherSocket = await socket(loser);
    expect((await ack(otherSocket, 'order:join', { orderId: order.trackingId })).ok).toBe(false);
    otherSocket.disconnect();
    for (const status of [
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.OUT_FOR_DELIVERY,
    ]) {
      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: `/api/orders/${order.id}/status`,
            headers: auth(winner),
            payload: { status },
          })
        ).statusCode,
      ).toBe(200);
    }
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/orders/${order.id}/status`,
          headers: auth(winner),
          payload: { status: OrderStatus.CANCELLED },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/orders/${order.id}/cancel`,
          headers: auth(loser),
          payload: { reason: 'Unable to complete this delivery' },
        })
      ).statusCode,
    ).toBe(403);
    const cancelled = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/status`,
      headers: auth(winner),
      payload: { status: OrderStatus.CANCELLED, note: 'Customer requested cancellation by phone' },
    });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().order.statusHistory[0].note).toBe(
      'Customer requested cancellation by phone',
    );
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/orders/${order.id}/status`,
          headers: auth('admin'),
          payload: { status: OrderStatus.DELIVERED },
        })
      ).statusCode,
    ).toBe(400);
  });

  it('limits profile and role editing to admins, handles concurrent edits and revokes changed access', async () => {
    const registration = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Managed Customer',
        email: 'managed@example.test',
        phone: '555-9876',
        password: 'Managed-password123!',
      },
    });
    expect(registration.statusCode).toBe(201);
    const id = registration.json().user.id as string;
    const oldHeaders = { authorization: `Bearer ${registration.json().accessToken}` };
    expect((await app.inject({ url: '/api/users' })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/users', headers: auth('courier1') })).statusCode).toBe(
      403,
    );
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/users/${id}`,
          headers: oldHeaders,
          payload: {},
        })
      ).statusCode,
    ).toBe(403);
    const listed = await app.inject({
      url: '/api/users?q=managed%40example.test&role=CUSTOMER&page=1&limit=10',
      headers: auth('admin'),
    });
    expect(listed.json().users).toHaveLength(1);
    expect(listed.body).not.toMatch(/passwordHash|managementHistory|resetTokenHash/);
    const user = listed.json().users[0];
    const update = {
      name: 'Managed Courier',
      email: user.email,
      phone: user.phone,
      role: UserRole.COURIER,
      disabled: false,
      expectedUpdatedAt: user.updatedAt,
    };
    const promoted = await app.inject({
      method: 'PATCH',
      url: `/api/users/${id}`,
      headers: auth('admin'),
      payload: update,
    });
    expect(promoted.statusCode).toBe(200);
    expect((await app.inject({ url: '/api/auth/me', headers: oldHeaders })).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/users/${id}`,
          headers: auth('admin'),
          payload: { ...update, name: 'Stale edit' },
        })
      ).statusCode,
    ).toBe(409);
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: user.email, password: 'Managed-password123!' },
    });
    expect(login.json().user.role).toBe(UserRole.COURIER);
    const courierHeaders = { authorization: `Bearer ${login.json().accessToken}` };
    expect(
      (await app.inject({ url: '/api/orders/available', headers: courierHeaders })).statusCode,
    ).toBe(200);
    const order = await create();
    await orders.assignCourier(order.id, id, actor('admin'));
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/users/${id}`,
          headers: auth('admin'),
          payload: {
            ...update,
            role: UserRole.CUSTOMER,
            expectedUpdatedAt: promoted.json().user.updatedAt,
          },
        })
      ).statusCode,
    ).toBe(409);
    await orders.cancelOrder(order.id, 'Kitchen cannot fulfil this order', {
      userId: actor('admin').id,
      role: UserRole.ADMIN,
      name: 'admin',
    });
    const disabled = await app.inject({
      method: 'PATCH',
      url: `/api/users/${id}`,
      headers: auth('admin'),
      payload: { ...update, disabled: true, expectedUpdatedAt: promoted.json().user.updatedAt },
    });
    expect(disabled.statusCode).toBe(200);
    expect(
      (await app.inject({ url: '/api/orders/available', headers: courierHeaders })).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: { email: user.email, password: 'Managed-password123!' },
        })
      ).statusCode,
    ).toBe(401);
    const admin = await userModel.findById(actor('admin').id);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/users/${actor('admin').id}`,
          headers: auth('admin'),
          payload: {
            ...update,
            email: admin!.email,
            role: UserRole.CUSTOMER,
            expectedUpdatedAt: admin!.updatedAt.toISOString(),
          },
        })
      ).statusCode,
    ).toBe(400);
  });

  it('limits packets while preserving acknowledgments and recovers after the window', async () => {
    const guest = await socket();
    const results = await Promise.all(Array.from({ length: 25 }, () => ack(guest, 'ping')));
    expect(results.filter((result) => !result.ok).length).toBeGreaterThan(0);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect((await ack(guest, 'ping')).ok).toBe(true);
    guest.disconnect();
  });

  it('keeps concurrent administrator access changes from removing each other’s authority', async () => {
    const passwordHash = await bcrypt.hash('Admin-review-password123!', 10);
    const admins = await userModel.create(
      ['first', 'second'].map((name) => ({
        name: `${name} review admin`,
        email: `${name}-review-admin@example.test`,
        role: UserRole.ADMIN,
        passwordHash,
      })),
    );
    const summary = (user: UserDocument): UserSummary => ({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    });
    const changes = await Promise.allSettled(
      admins.map((target, index) =>
        app.get(UsersService).update(
          target._id.toString(),
          {
            name: target.name,
            email: target.email,
            phone: '',
            disabled: false,
            role: UserRole.CUSTOMER,
            expectedUpdatedAt: target.updatedAt.toISOString(),
          },
          summary(admins[1 - index]!),
        ),
      ),
    );
    expect(changes.filter((change) => change.status === 'fulfilled')).toHaveLength(1);
    expect(
      await userModel.countDocuments({
        _id: { $in: admins.map((user) => user._id) },
        role: UserRole.ADMIN,
        disabled: false,
      }),
    ).toBe(1);
  });

  it('does not assign a delivery while the courier’s access change is being committed', async () => {
    const courier = await userModel.create({
      name: 'Changing Courier',
      email: 'changing-courier@example.test',
      role: UserRole.COURIER,
      passwordHash: await bcrypt.hash('Courier-review-password123!', 10),
    });
    const order = await create('customer2');
    let reached!: () => void;
    let release!: () => void;
    const paused = new Promise<void>((resolve) => {
      reached = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const original = userModel.findOneAndUpdate.bind(userModel);
    const updateSpy = vi.spyOn(userModel, 'findOneAndUpdate').mockImplementationOnce((...args) => {
      const query = original(...args);
      const exec = query.exec.bind(query);
      vi.spyOn(query, 'exec').mockImplementationOnce(async () => {
        reached();
        await gate;
        return exec();
      });
      return query;
    });
    const edit = app.get(UsersService).update(
      courier._id.toString(),
      {
        name: courier.name,
        email: courier.email,
        phone: '',
        role: UserRole.CUSTOMER,
        disabled: false,
        expectedUpdatedAt: courier.updatedAt.toISOString(),
      },
      actor('admin'),
    );
    let assignment;
    try {
      await paused;
      assignment = await app.inject({
        method: 'POST',
        url: `/api/orders/${order.id}/courier`,
        headers: auth('admin'),
        payload: { courierId: courier._id.toString() },
      });
    } finally {
      release();
      updateSpy.mockRestore();
    }
    await edit;
    expect(assignment.statusCode).toBe(409);
    expect((await orderModel.findById(order.id))?.courierId).toBeNull();
    expect((await userModel.findById(courier._id))?.role).toBe(UserRole.CUSTOMER);
  });

  it.each(['email', 'role', 'disable and re-enable'] as const)(
    'invalidates outstanding password reset codes when an administrator changes %s',
    async (change) => {
      mail.mockClear();
      const email = `reset-${change.replaceAll(' ', '-')}@example.test`;
      const registration = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          name: 'Recovery Access Review',
          email,
          phone: '555-1234',
          password: 'Original-password123!',
        },
      });
      expect(registration.statusCode).toBe(201);
      const token = await issueResetGrant(email);
      const id = registration.json().user.id as string;
      const user = await userModel.findById(id);
      const update = {
        name: user!.name,
        email: change === 'email' ? `new-${email}` : email,
        phone: user!.phone,
        role: change === 'role' ? UserRole.COURIER : UserRole.CUSTOMER,
        disabled: change === 'disable and re-enable',
        expectedUpdatedAt: user!.updatedAt.toISOString(),
      };
      const edited = await app.inject({
        method: 'PATCH',
        url: `/api/users/${id}`,
        headers: auth('admin'),
        payload: update,
      });
      expect(edited.statusCode).toBe(200);
      let enabledStatus = 200;
      if (update.disabled) {
        enabledStatus = (
          await app.inject({
            method: 'PATCH',
            url: `/api/users/${id}`,
            headers: auth('admin'),
            payload: {
              ...update,
              disabled: false,
              expectedUpdatedAt: edited.json().user.updatedAt,
            },
          })
        ).statusCode;
      }
      expect(enabledStatus).toBe(200);
      const reset = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        payload: {
          token,
          password: 'Unwanted-password123!',
          confirmPassword: 'Unwanted-password123!',
        },
      });
      expect(reset.statusCode).toBe(400);
      const login = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: update.email, password: 'Original-password123!' },
      });
      expect(login.statusCode).toBe(200);
      const stored = await userModel
        .findById(id)
        .select('+resetTokenHash +resetExpiresAt +resetRequestedAt');
      expect(stored?.resetTokenHash).toBeUndefined();
      expect(stored?.resetExpiresAt).toBeUndefined();
      expect(stored?.resetRequestedAt).toBeUndefined();
    },
  );

  it('acknowledges committed HTTP and socket mutations when live notification delivery fails', async () => {
    const gateway = app.get(OrdersGateway);
    const broadcast = vi.spyOn(gateway.server, 'in').mockImplementation(() => {
      throw new Error('Synthetic notification adapter failure');
    });
    try {
      const created = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: auth('customer2'),
        payload: dto,
      });
      expect(created.statusCode).toBe(201);
      const order = created.json().order as OrderDetails;
      const confirmed = await app.inject({
        method: 'PATCH',
        url: `/api/orders/${order.id}/status`,
        headers: auth('admin'),
        payload: { status: OrderStatus.CONFIRMED },
      });
      expect(confirmed.statusCode).toBe(200);
      const admin = await socket('admin');
      expect(
        (
          await ack(admin, 'order:update_status', {
            orderId: order.id,
            status: OrderStatus.PREPARING,
          })
        ).ok,
      ).toBe(true);
      const cancelled = await app.inject({
        method: 'POST',
        url: `/api/orders/${order.id}/cancel`,
        headers: auth('admin'),
        payload: { reason: 'Synthetic kitchen cancellation' },
      });
      expect(cancelled.statusCode).toBe(201);
      expect((await orders.getOrderById(order.id, actor('admin'))).statusHistory).toHaveLength(4);
      admin.disconnect();
    } finally {
      broadcast.mockRestore();
    }
  });

  it('rotates HttpOnly refresh cookies, blocks cross-origin refresh and revokes reused tokens', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'customer1@example.test', password: 'Test-password123!' },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json()).not.toHaveProperty('refreshToken');
    const cookie = String(login.headers['set-cookie']);
    expect(cookie).toContain('HttpOnly; SameSite=Strict');
    const original = cookie.split(';')[0]!;
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/refresh',
          headers: { cookie: original, origin: 'https://attacker.example.test' },
        })
      ).statusCode,
    ).toBe(403);
    const refreshed = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { cookie: original },
    });
    expect(refreshed.statusCode).toBe(200);
    expect(String(refreshed.headers['set-cookie']).split(';')[0]).not.toBe(original);
    const freshHeaders = { authorization: `Bearer ${refreshed.json().accessToken}` };
    expect((await app.inject({ url: '/api/auth/me', headers: freshHeaders })).statusCode).toBe(200);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/refresh',
          headers: { cookie: original },
        })
      ).statusCode,
    ).toBe(401);
    expect((await app.inject({ url: '/api/auth/me', headers: freshHeaders })).statusCode).toBe(401);
  });

  it('keeps an activated account when registration email delivery fails after verification', async () => {
    const email = 'late-registration-mail@example.test';
    let deliveredCode: string | undefined;
    let failDelivery: ((error: Error) => void) | undefined;
    const delivery = vi
      .spyOn(app.get(RecoveryMailer), 'sendOtp')
      .mockImplementationOnce(async (_email, _purpose, code) => {
        deliveredCode = code;
        await new Promise<void>((_resolve, reject) => {
          failDelivery = reject;
        });
      });
    const pendingRegistration = Promise.resolve(
      directInject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          name: 'Late Mail Customer',
          email,
          password: 'Original-password123!',
          phone: '555-1234',
        },
      }),
    );
    try {
      await vi.waitFor(() => expect(failDelivery).toBeTypeOf('function'));
      const challenge = await app
        .get<Model<AuthChallenge>>(getModelToken(AuthChallenge.name))
        .findOne({ email, purpose: 'email_verification' });
      if (!challenge || !failDelivery || !deliveredCode)
        throw new Error('Expected a pending verification email');
      const verified = await directInject({
        method: 'POST',
        url: '/api/auth/email/verify',
        payload: { challengeId: challenge._id, code: deliveredCode, deviceId: randomUUID() },
      });
      expect(verified.statusCode).toBe(200);
      failDelivery(new Error('Synthetic SMTP acknowledgement failure'));
      expect((await pendingRegistration).statusCode).toBe(503);
      expect(await userModel.findOne({ email }).select('emailVerified')).toMatchObject({
        emailVerified: true,
      });
      expect(
        (
          await app.inject({
            url: '/api/auth/me',
            headers: {
              authorization: `Bearer ${verified.json<{ accessToken: string }>().accessToken}`,
            },
          })
        ).statusCode,
      ).toBe(200);
    } finally {
      failDelivery?.(new Error('Finish synthetic email failure'));
      await pendingRegistration;
      delivery.mockRestore();
    }
  });

  it('rejects a delayed reset grant from an earlier verified code after a new code is verified', async () => {
    const user = await userModel.create({
      name: 'Reset Generation Customer',
      email: 'reset-generation@example.test',
      passwordHash: await bcrypt.hash('Original-password123!', 10),
      emailVerified: true,
    });
    const otp = app.get(AuthOtpService);
    const first = await otp.begin(user.email, 'password_reset', user._id.toString());
    const oldCode = await smtp.takeOtp(user.email);
    const oldVerified = await otp.verify(first.challengeId, oldCode, 'password_reset');
    const second = await otp.begin(user.email, 'password_reset', user._id.toString());
    const freshCode = await smtp.takeOtp(user.email);
    const freshVerified = await otp.verify(second.challengeId, freshCode, 'password_reset');
    // Resume the first request at the grant exchange after the second request has verified.
    await expect(otp.createResetGrant(oldVerified, oldCode)).rejects.toThrow(
      'This password reset code has already been used.',
    );
    const freshToken = await otp.createResetGrant(freshVerified, freshCode);
    await expect(otp.consumeResetGrant(freshToken)).resolves.toMatchObject({
      userId: user._id.toString(),
    });
  });

  it('issues only one reset grant when the same verified code is exchanged concurrently', async () => {
    const user = await userModel.create({
      name: 'Reset Exchange Customer',
      email: 'reset-exchange@example.test',
      passwordHash: await bcrypt.hash('Original-password123!', 10),
      emailVerified: true,
    });
    const otp = app.get(AuthOtpService);
    const challenge = await otp.begin(user.email, 'password_reset', user._id.toString());
    const code = await smtp.takeOtp(user.email);
    const verified = await otp.verify(challenge.challengeId, code, 'password_reset');
    const exchanges = await Promise.allSettled([
      otp.createResetGrant(verified, code),
      otp.createResetGrant(verified, code),
    ]);
    expect(exchanges.filter((exchange) => exchange.status === 'fulfilled')).toHaveLength(1);
    const success = exchanges.find((exchange) => exchange.status === 'fulfilled');
    if (!success) throw new Error('Expected one reset grant');
    await expect(otp.consumeResetGrant(success.value)).resolves.toMatchObject({
      userId: user._id.toString(),
    });
  });

  it('delivers a private one-time password reset and invalidates existing credentials atomically', async () => {
    mail.mockClear();
    const email = 'recovery@example.test';
    const registered = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Recovery Customer',
        email,
        phone: '555-1234',
        password: 'Old-password123!',
      },
    });
    expect(registered.statusCode).toBe(201);
    const responses = await Promise.all(
      [email, 'missing@example.test'].map((address) =>
        app.inject({
          method: 'POST',
          url: '/api/auth/forgot-password',
          payload: { email: address },
        }),
      ),
    );
    expect(responses[0]!.json<AuthChallengeResponse>()).toMatchObject({
      status: 'verification_required',
      purpose: 'password_reset',
      email,
    });
    expect(responses[1]!.json<AuthChallengeResponse>()).toMatchObject({
      status: 'verification_required',
      purpose: 'password_reset',
      email: 'missing@example.test',
    });
    expect(Object.keys(responses[0]!.json()).sort()).toEqual(
      Object.keys(responses[1]!.json()).sort(),
    );
    const challenge = responses[0]!.json<AuthChallengeResponse>();
    const resetCode = await smtp.takeOtp(email);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/reset-password/verify',
          payload: { challengeId: challenge.challengeId, code: '000000' },
        })
      ).statusCode,
    ).toBe(400);
    const verified = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password/verify',
      payload: { challengeId: challenge.challengeId, code: resetCode },
    });
    expect(verified.statusCode).toBe(200);
    const resetToken = verified.json<{ resetToken: string }>().resetToken;
    expect(resetToken).toMatch(/^reset_[\w-]{43}$/);
    const storedChallenge = await app
      .get<Model<{ resetGrantHash: string }>>(getModelToken(AuthChallenge.name))
      .findById(challenge.challengeId)
      .select('+resetGrantHash')
      .lean();
    expect(storedChallenge?.resetGrantHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(storedChallenge)).not.toContain(resetToken);
    const reset = await Promise.all(
      Array.from({ length: 2 }, () =>
        app.inject({
          method: 'POST',
          url: '/api/auth/reset-password',
          payload: {
            token: resetToken,
            password: 'New-password123!',
            confirmPassword: 'New-password123!',
          },
        }),
      ),
    );
    expect(reset.map((response) => response.statusCode).sort((a, b) => a - b)).toEqual([200, 400]);
    expect(
      (
        await app.inject({
          url: '/api/auth/me',
          headers: { authorization: `Bearer ${registered.json().accessToken}` },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: { email, password: 'Old-password123!' },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: { email, password: 'New-password123!' },
        })
      ).statusCode,
    ).toBe(200);
  });

  it.each(['logout', 'password reset'] as const)(
    'acknowledges %s once credentials are invalidated even if session cleanup fails',
    async (action) => {
      mail.mockClear();
      const email = `cleanup-${action.replaceAll(' ', '-')}@example.test`;
      const registered = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          name: 'Session Cleanup Review',
          email,
          phone: '555-1234',
          password: 'Original-password123!',
        },
      });
      expect(registered.statusCode).toBe(201);
      const cookie = String(registered.headers['set-cookie']).split(';')[0]!;
      const authorization = `Bearer ${registered.json().accessToken}`;
      let token: string | undefined;
      if (action === 'password reset') {
        token = await issueResetGrant(email);
      }
      const cleanup = vi
        .spyOn(app.get<Model<AuthSession>>(getModelToken(AuthSession.name)), 'updateMany')
        .mockImplementationOnce(() => {
          throw new Error('Synthetic auxiliary cleanup failure');
        });
      try {
        const response = await app.inject(
          action === 'logout'
            ? {
                method: 'POST',
                url: '/api/auth/logout',
                headers: { authorization, cookie },
              }
            : {
                method: 'POST',
                url: '/api/auth/reset-password',
                payload: {
                  token,
                  password: 'Changed-password123!',
                  confirmPassword: 'Changed-password123!',
                },
              },
        );
        expect(response.statusCode).toBe(200);
      } finally {
        cleanup.mockRestore();
      }
      await vi.waitFor(() =>
        expect(mail).toHaveBeenCalledTimes(action === 'password reset' ? 1 : 0),
      );
      expect(
        (await app.inject({ url: '/api/auth/me', headers: { authorization } })).statusCode,
      ).toBe(401);
      expect(
        (await app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { cookie } }))
          .statusCode,
      ).toBe(401);
      const login = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email,
          password: action === 'logout' ? 'Original-password123!' : 'Changed-password123!',
        },
      });
      expect(login.statusCode).toBe(200);
      expect(
        (
          await app.inject({
            url: '/api/auth/me',
            headers: { authorization: `Bearer ${login.json().accessToken}` },
          })
        ).statusCode,
      ).toBe(200);
    },
  );

  it('enforces changed roles and server revocation on HTTP and existing sockets', async () => {
    const admin = await socket('admin');
    let received = false;
    admin.on('order:created', () => {
      received = true;
    });
    await userModel.updateOne({ _id: actor('admin').id }, { $set: { role: UserRole.CUSTOMER } });
    expect((await app.inject({ url: '/api/orders', headers: auth('admin') })).statusCode).toBe(403);
    const order = await create();
    await app.get(OrdersGateway).notifyOrderCreated(order);
    await ack(admin, 'ping'); // Packet acknowledgment confirms the preceding broadcast was processed.
    expect(received).toBe(false);
    await userModel.updateOne({ _id: actor('admin').id }, { $set: { role: UserRole.ADMIN } });
    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: auth('admin'),
    });
    expect(logout.statusCode).toBe(200);
    expect((await app.inject({ url: '/api/orders', headers: auth('admin') })).statusCode).toBe(401);
    admin.disconnect();
  });

  it('reports a database outage, recovers without restarting the API and preserves the audit trail', async () => {
    const order = await create('customer2');
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'customer2@example.test', password: 'Test-password123!' },
    });
    expect(login.statusCode).toBe(200);
    const refreshCookie = String(login.headers['set-cookie']).split(';')[0]!;
    expect((await app.inject({ url: '/api/health/ready' })).statusCode).toBe(200);
    const uri = mongo.getUri('ktd_integration');
    await mongo.stop({ doCleanup: false });
    const recoveringSocket = io(base, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 100,
      reconnectionDelayMax: 500,
      auth: { token: tokens.get('customer2') },
    });
    sockets.push(recoveringSocket);
    const codes: string[] = [];
    let authenticatedAgain = false;
    recoveringSocket.on('error', (error: { code: string }) => codes.push(error.code));
    recoveringSocket.on('authenticated', () => {
      authenticatedAgain = true;
    });
    expect((await app.inject({ url: '/api/health/live' })).statusCode).toBe(200);
    expect((await app.inject({ url: '/api/health/ready' })).statusCode).toBe(503);
    const refreshDuringOutage = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { cookie: refreshCookie },
    });
    expect(refreshDuringOutage.statusCode).toBe(503);
    expect(refreshDuringOutage.headers['set-cookie']).toBeUndefined();
    expect(
      (await app.inject({ url: `/api/orders/${order.trackingId}`, headers: auth('customer2') }))
        .statusCode,
    ).toBe(503);
    await vi.waitFor(() => expect(codes).toContain('SERVICE_UNAVAILABLE'), { timeout: 5000 });
    await mongo.start(true);
    expect(mongo.getUri('ktd_integration')).toBe(uri);
    await vi.waitFor(
      async () => expect((await app.inject({ url: '/api/health/ready' })).statusCode).toBe(200),
      { timeout: 10_000 },
    );
    const recovered = await app.inject({
      url: `/api/orders/${order.trackingId}`,
      headers: auth('customer2'),
    });
    expect(recovered.statusCode).toBe(200);
    expect(recovered.headers['cache-control']).toBe('no-store');
    expect(recovered.json().order.statusHistory).toHaveLength(1);
    const renewed = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { cookie: refreshCookie },
    });
    expect(renewed.statusCode).toBe(200);
    expect(renewed.headers['set-cookie']).toBeDefined();
    await vi.waitFor(() => expect(authenticatedAgain).toBe(true), { timeout: 10_000 });
    expect(codes).not.toContain('UNAUTHORIZED');
    recoveringSocket.disconnect();
  });
});
