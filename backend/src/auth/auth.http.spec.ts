import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { getModelToken } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { UserRole } from '@kitchentodoor/shared';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { RolesGuard } from './guards/roles.guard.js';
import { User } from '../database/schemas/user.schema.js';
import { OrdersController } from '../orders/orders.controller.js';
import { OrdersService } from '../orders/orders.service.js';
import { OrdersGateway } from '../orders/orders.gateway.js';
import { ThrottlerModule } from '@nestjs/throttler';
import { httpRateLimiterProvider } from '../common/rate-limit.js';
import { getRuntimeSettings } from '../config/runtime-settings.js';
import { PublicConfigController } from '../config/public-config.controller.js';
import { AuthSession } from '../database/schemas/auth-session.schema.js';
import { RecoveryMailer } from './recovery-mailer.js';

const users = new Map<string, Record<string, unknown>>();
const userModel = {
  findOne: async ({ email }: { email: string }) => users.get(email) ?? null,
  findById: async (id: string) => [...users.values()].find((user) => user._id === id),
  updateOne: async ({ _id }: { _id: string }) => {
    const user = [...users.values()].find((entry) => entry._id === _id);
    if (user) user.tokenVersion = Number(user.tokenVersion ?? 0) + 1;
    return { modifiedCount: user ? 1 : 0 };
  },
  create: async (user: Record<string, unknown>) => {
    const created = { ...user, _id: `user-${users.size}` };
    users.set(String(user.email), created);
    return created;
  },
};

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({ secret: 'http-regression-test-secret', signOptions: { expiresIn: '1h' } }),
    ThrottlerModule.forRootAsync({
      useFactory: () => [
        { ttl: getRuntimeSettings().RATE_LIMIT_TTL_MS, limit: getRuntimeSettings().RATE_LIMIT_MAX },
      ],
    }),
  ],
  controllers: [AuthController, OrdersController, PublicConfigController],
  providers: [
    AuthService,
    JwtStrategy,
    RolesGuard,
    httpRateLimiterProvider,
    { provide: getModelToken(User.name), useValue: userModel },
    {
      provide: getModelToken(AuthSession.name),
      useValue: {
        create: async () => ({}),
        exists: async () => true,
        updateMany: async () => ({}),
      },
    },
    { provide: RecoveryMailer, useValue: { send: vi.fn<RecoveryMailer['send']>() } },
    {
      provide: OrdersService,
      useValue: {
        getAllOrders: async () => [],
        countOrders: async () => 26,
        countMyOrders: async () => 26,
        getMyOrders: async () => [],
        getOrderById: async (orderNumber: string) => ({ orderNumber }),
      },
    },
    { provide: OrdersGateway, useValue: {} },
  ],
})
class HttpTestModule {}

describe('Authentication through the NestJS HTTP pipeline', () => {
  let app: NestFastifyApplication;
  let adminToken: string;

  beforeAll(async () => {
    vi.stubEnv('JWT_SECRET', 'http-regression-test-secret');
    // tsx does not emit design:paramtypes. Exercise that same dependency-injection path.
    for (const provider of [AuthController, OrdersController, RolesGuard]) {
      Reflect.deleteMetadata('design:paramtypes', provider);
    }
    users.set('admin@example.com', {
      _id: 'admin-id',
      name: 'Dispatcher',
      email: 'admin@example.com',
      passwordHash: await bcrypt.hash('correct-password', 4),
      role: UserRole.ADMIN,
    });
    users.set('existing-customer@example.com', {
      _id: 'customer-id',
      name: 'Customer',
      email: 'existing-customer@example.com',
      role: UserRole.CUSTOMER,
    });
    app = await NestFactory.create<NestFastifyApplication>(HttpTestModule, new FastifyAdapter(), {
      logger: false,
    });
    adminToken = app.get(JwtService).sign({
      sub: 'admin-id',
      email: 'admin@example.com',
      name: 'Dispatcher',
      role: UserRole.ADMIN,
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });

  it('signs in with a normalized email and returns a usable token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: '  ADMIN@EXAMPLE.COM  ', password: 'correct-password' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      accessToken: expect.any(String),
      user: { role: 'ADMIN' },
    });
  });

  it('returns 401 for an incorrect password', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@example.com', password: 'wrong-password' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('returns field validation errors instead of an internal server error', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'invalid', password: '' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email' })]),
    );
  });

  it('loads the current user through an authenticated request', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().email).toBe('admin@example.com');
  });

  it('allows an administrator to open the dispatch orders endpoint', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/orders',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ success: true, orders: [] });
  });

  it('rejects dispatch access for a customer', async () => {
    const token = app.get(JwtService).sign({ sub: 'customer-id', role: UserRole.CUSTOMER });
    const response = await app.inject({
      method: 'GET',
      url: '/api/orders',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it.each(['limit=nope', 'limit=0', 'limit=-1', 'limit=10000', 'status=INVALID'])(
    'rejects invalid dispatch query %s',
    async (query) => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/orders?${query}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(400);
    },
  );

  it.each([UserRole.ADMIN, UserRole.COURIER])('rejects public registration as %s', async (role) => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Customer',
        email: `${role}@example.com`,
        password: 'some-password',
        phone: '555-1234',
        role,
      },
    });
    expect(response.statusCode).toBe(400);
  });

  it('registers a customer when no role is supplied', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Customer',
        email: 'customer@example.com',
        password: 'some-password',
        phone: '555-1234',
      },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().user.role).toBe(UserRole.CUSTOMER);
  });

  it('does not allow an unauthenticated caller to cancel an order', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/orders/KTD-1000/cancel',
      payload: {},
    });
    expect(response.statusCode).toBe(401);
  });

  it('rejects cancelled-order access by a customer', async () => {
    const token = app.get(JwtService).sign({ sub: 'customer-id', role: UserRole.CUSTOMER });
    const response = await app.inject({
      method: 'POST',
      url: '/api/orders/KTD-1000/cancel',
      payload: {},
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it.each([
    '/api/orders/not-an-order',
    '/api/orders/my-orders?page=0',
    '/api/orders/my-orders?phone=letters',
    '/api/orders/my-orders?phone=123',
  ])('rejects malformed lookup input at %s', async (url) => {
    const response = await app.inject({
      method: 'GET',
      url,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().errors.length).toBeGreaterThan(0);
  });

  it('normalizes an order-number URL before looking it up', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/orders/ktd-1234',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().order.orderNumber).toBe('KTD-1234');
  });

  it('returns public pricing without exposing secrets', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/config' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ pricing: { deliveryFee: 5, taxRate: 0.08 } });
    expect(response.body).not.toContain('http-regression-test-secret');
  });

  it('uses custom login limits and retry windows from the environment', async () => {
    const previousLimit = process.env.LOGIN_RATE_LIMIT_MAX;
    const previousTtl = process.env.LOGIN_RATE_LIMIT_TTL_MS;
    process.env.LOGIN_RATE_LIMIT_MAX = '2';
    process.env.LOGIN_RATE_LIMIT_TTL_MS = '180000';
    try {
      const statuses = [];
      let response;
      for (let attempt = 0; attempt < 3; attempt++) {
        response = await app.inject({
          method: 'POST',
          url: '/api/auth/login',
          remoteAddress: '127.0.0.9',
          payload: { email: 'admin@example.com', password: 'incorrect-password' },
        });
        statuses.push(response.statusCode);
      }
      expect(statuses).toEqual([401, 401, 429]);
      expect(Number(response?.headers['retry-after'])).toBeGreaterThan(60);
    } finally {
      if (previousLimit === undefined) delete process.env.LOGIN_RATE_LIMIT_MAX;
      else process.env.LOGIN_RATE_LIMIT_MAX = previousLimit;
      if (previousTtl === undefined) delete process.env.LOGIN_RATE_LIMIT_TTL_MS;
      else process.env.LOGIN_RATE_LIMIT_TTL_MS = previousTtl;
    }
  });

  it('uses configured pagination bounds when validating a dispatch request', async () => {
    const previousMaximum = process.env.ORDER_LIST_MAX_LIMIT;
    const previousDefault = process.env.ORDER_LIST_DEFAULT_LIMIT;
    process.env.ORDER_LIST_MAX_LIMIT = '2';
    process.env.ORDER_LIST_DEFAULT_LIMIT = '1';
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/orders?limit=3',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'limit' })]),
      );
    } finally {
      if (previousMaximum === undefined) delete process.env.ORDER_LIST_MAX_LIMIT;
      else process.env.ORDER_LIST_MAX_LIMIT = previousMaximum;
      if (previousDefault === undefined) delete process.env.ORDER_LIST_DEFAULT_LIMIT;
      else process.env.ORDER_LIST_DEFAULT_LIMIT = previousDefault;
    }
  });

  it('returns dispatch pagination and clamps pages beyond the filtered total', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/orders?page=99&limit=25&search=Shamiul',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().pagination).toEqual({ page: 2, pageSize: 25, total: 26, totalPages: 2 });
  });

  it('paginates phone history without the old implicit history cutoff', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/orders/my-orders?phone=555-1234&page=2&limit=10',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().pagination).toEqual({ page: 2, pageSize: 10, total: 26, totalPages: 3 });
  });

  it('rejects anonymous phone-based history lookup', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/orders/my-orders?phone=555-1234',
    });
    expect(response.statusCode).toBe(401);
  });

  it.each(['page=0', 'page=-1', 'page=1.5', 'page=nope', `search=${'x'.repeat(101)}`])(
    'rejects invalid list controls: %s',
    async (query) => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/orders?${query}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(400);
    },
  );

  it('rate limits repeated login attempts', async () => {
    let status = 0;
    for (let attempt = 0; attempt < 11; attempt++) {
      const result = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'admin@example.com', password: 'incorrect-password' },
      });
      status = result.statusCode;
    }
    expect(status).toBe(429);
  });
});
