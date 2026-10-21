import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
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
} from '@kitchentodoor/shared';
import { OrdersService } from './orders.service.js';
import { OrdersGateway } from './orders.gateway.js';
import { User, type UserDocument } from '../database/schemas/user.schema.js';
import { Order, type OrderDocument } from '../database/schemas/order.schema.js';
import { BoundedSocketAdapter } from '../common/socket-adapter.js';
import { RecoveryMailer } from '../auth/recovery-mailer.js';
import { AuthSession } from '../database/schemas/auth-session.schema.js';
import bcrypt from 'bcryptjs';

describe('Real MongoDB, HTTP and Socket.IO authorization and consistency', () => {
  let mongo: MongoMemoryServer;
  let app: NestFastifyApplication;
  let orders: OrdersService;
  let userModel: Model<UserDocument>;
  let orderModel: Model<OrderDocument>;
  let base: string;
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
      LOGIN_RATE_LIMIT_MAX: '1000',
      SOCKET_IP_RATE_LIMIT_MAX: '500',
      SOCKET_RATE_LIMIT_WINDOW_MS: '1000',
      AUTH_COOKIE_SECURE: 'false',
      PASSWORD_HASH_ROUNDS: '10',
      PASSWORD_RESET_ENABLED: 'true',
      SMTP_HOST: 'smtp.example.test',
      SMTP_FROM: 'kitchen@example.test',
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
    expect(responses[0]!.json()).toEqual(responses[1]!.json());
    await vi.waitFor(() => expect(mail).toHaveBeenCalledOnce());
    const text = mail.mock.calls[0]![2];
    const link = new URL(text.match(/https:\/\/\S+/)![0]);
    const resetToken = new URLSearchParams(link.hash.slice(1)).get('token')!;
    expect(resetToken).toMatch(/^reset_[\w-]{43}$/);
    expect(link.search).toBe('');
    const stored = await userModel.findOne({ email }).select('+resetTokenHash').lean();
    expect(stored?.resetTokenHash).toHaveLength(64);
    expect(JSON.stringify(stored)).not.toContain(resetToken);
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
    await vi.waitFor(() => expect(authenticatedAgain).toBe(true), { timeout: 10_000 });
    expect(codes).not.toContain('UNAUTHORIZED');
    recoveringSocket.disconnect();
  });
});
