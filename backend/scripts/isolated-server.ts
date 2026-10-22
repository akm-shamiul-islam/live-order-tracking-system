// Only the isolated tooling parent starts this child; development data is never used.
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import type { INestApplication } from '@nestjs/common';
import type { Model } from 'mongoose';
import type { OrderDetails } from '@kitchentodoor/shared';
import type { UserDocument } from '../src/database/schemas/user.schema.ts';
import type { OrderDocument } from '../src/database/schemas/order.schema.ts';
import type { AuthSession as AuthSessionRecord } from '../src/database/schemas/auth-session.schema.ts';
import type { RuntimeReady } from './runtime-contracts.ts';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import { packageVersion } from '../../scripts/lib/json.ts';

const require = createRequire(import.meta.url);
if (
  !process.send ||
  process.env.KTD_ISOLATED_RUN !== 'true' ||
  !/^mongodb:\/\/127\.0\.0\.1:\d+\/ktd_/.test(process.env.MONGODB_URI || '')
) {
  throw new Error('This server requires an isolated test database and an IPC parent.');
}
const password = process.env.KTD_TEST_PASSWORD;
if (!password) throw new Error('The isolated test password is required.');

interface BackendModules {
  'database/schemas/user.schema': typeof import('../src/database/schemas/user.schema.ts');
  'database/schemas/order.schema': typeof import('../src/database/schemas/order.schema.ts');
  'database/schemas/auth-session.schema': typeof import('../src/database/schemas/auth-session.schema.ts');
  'orders/orders.service': typeof import('../src/orders/orders.service.ts');
  'auth/auth.service': typeof import('../src/auth/auth.service.ts');
  'auth/auth-otp.service': typeof import('../src/auth/auth-otp.service.ts');
  'common/cors': typeof import('../src/common/cors.ts');
  'common/socket-adapter': typeof import('../src/common/socket-adapter.ts');
  'common/client-address': typeof import('../src/common/client-address.ts');
  'app.module': typeof import('../src/app.module.ts');
  bootstrap: typeof import('../src/bootstrap.ts');
}

async function importBuilt<Module extends keyof BackendModules>(
  name: Module,
): Promise<BackendModules[Module]> {
  const module: unknown = await import(new URL(`../dist/${name}.js`, import.meta.url).href);
  return module as BackendModules[Module];
}

const { UserRole, OrderStatus } = await import('@kitchentodoor/shared');
const { User } = await importBuilt('database/schemas/user.schema');
const { Order } = await importBuilt('database/schemas/order.schema');
const { AuthSession } = await importBuilt('database/schemas/auth-session.schema');
const { OrdersService } = await importBuilt('orders/orders.service');
const { AuthService } = await importBuilt('auth/auth.service');
const { AuthOtpService } = await importBuilt('auth/auth-otp.service');
const { allowedOrigins } = await importBuilt('common/cors');
const { BoundedSocketAdapter } = await importBuilt('common/socket-adapter');
let app: INestApplication | undefined;
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await app?.close();
  process.exit(0);
}
process.on('message', (message: unknown) => {
  if (message && typeof message === 'object' && 'type' in message && message.type === 'stop')
    void close();
});
process.on('disconnect', () => void close());
process.on('SIGTERM', () => void close());
try {
  if (process.env.KTD_ADAPTER === 'express') {
    const { AppModule } = await importBuilt('app.module');
    const { ExpressAdapter } = await import('@nestjs/platform-express');
    app = await NestFactory.create(AppModule, new ExpressAdapter(), {
      logger: false,
      abortOnError: false,
    });
    app.use(
      helmet({
        contentSecurityPolicy: false,
        referrerPolicy: { policy: 'no-referrer' },
        crossOriginEmbedderPolicy: true,
      }),
    );
    app.enableCors({
      origin: allowedOrigins(),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    });
    const { isTrustedProxy } = await importBuilt('common/client-address');
    app
      .getHttpAdapter()
      .getInstance()
      .set('trust proxy', (address: string) => isTrustedProxy(address));
    app.useWebSocketAdapter(new BoundedSocketAdapter(app));
    await app.init();
  } else {
    const { createApplication } = await importBuilt('bootstrap');
    app = await createApplication(true);
  }
  await app.listen(Number(process.env.KTD_LISTEN_PORT || 0), '127.0.0.1');
  const users = app.get<Model<UserDocument>>(getModelToken(User.name));
  const orders = app.get<Model<OrderDocument>>(getModelToken(Order.name));
  const sessions = app.get<Model<AuthSessionRecord>>(getModelToken(AuthSession.name));
  await Promise.all([users.init(), orders.init(), sessions.init()]);
  let first: OrderDetails | undefined;
  if (process.env.KTD_SEED === 'true') {
    const passwordHash = await bcrypt.hash(password, 10);
    await users.create([
      {
        name: 'Test Dispatcher',
        email: 'dispatcher@example.test',
        passwordHash,
        role: UserRole.ADMIN,
      },
      { name: 'Test Courier', email: 'courier@example.test', passwordHash, role: UserRole.COURIER },
      {
        name: 'Test Customer',
        email: 'customer@example.test',
        passwordHash,
        phone: '555-1234',
        role: UserRole.CUSTOMER,
      },
    ]);
    const service = app.get(OrdersService);
    const customer = await users.findOne({ role: UserRole.CUSTOMER });
    if (!customer) throw new Error('The synthetic customer was not created.');
    const count = Number(process.env.KTD_FIXTURE_ORDERS || 100);
    for (let start = 0; start < count; start += 8) {
      const batch = await Promise.all(
        Array.from({ length: Math.min(8, count - start) }, (_, index) =>
          service.createOrder(
            {
              customer: {
                name: `Synthetic Customer ${start + index + 1}`,
                phone: '555-1234',
                address: '123 Test Street',
              },
              deliveryAddress: '123 Test Street',
              deliveryCoordinates: { lat: 40.7128, lng: -74.006 },
              items: [{ itemId: 'item-1', name: 'House burger', price: 15.99, quantity: 1 }],
            },
            customer._id.toString(),
          ),
        ),
      );
      first ??= batch[0];
    }
    const admin = await users.findOne({ role: UserRole.ADMIN });
    const courier = await users.findOne({ role: UserRole.COURIER });
    if (!first || !admin || !courier)
      throw new Error('The synthetic delivery fixture is incomplete.');
    const actor = {
      id: admin._id.toString(),
      role: UserRole.ADMIN,
      name: admin.name,
      email: admin.email,
    };
    for (const status of [
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
      OrderStatus.READY_FOR_PICKUP,
    ]) {
      await service.updateOrderStatus(first.id, status, undefined, {
        userId: actor.id,
        role: actor.role,
        name: actor.name,
      });
    }
    await service.assignCourier(first.id, courier._id.toString(), actor);
  }
  const deviceId = randomUUID();
  const otp = app.get(AuthOtpService);
  await users.updateOne(
    { email: 'dispatcher@example.test' },
    { $set: { trustedDeviceHashes: [otp.hashDeviceId(deviceId)] } },
  );
  const login = await app.get(AuthService).login({
    email: 'dispatcher@example.test',
    password,
    deviceId,
  });
  if (!('refreshToken' in login)) throw new Error('The isolated admin fixture was not trusted.');
  const database = users.db.db;
  if (!database) throw new Error('The isolated database is unavailable.');
  const info = await database.admin().command({ buildInfo: 1 });
  if (typeof info.version !== 'string') throw new Error('MongoDB did not report its version.');
  const trackingId = first?.trackingId || process.env.KTD_TRACKING_ID;
  const orderId = first?.id || process.env.KTD_ORDER_ID;
  if (!trackingId || !orderId) throw new Error('The isolated order identifiers are missing.');
  const ready: RuntimeReady = {
    type: 'ready',
    base: await app.getUrl(),
    token: login.accessToken,
    user: login.user,
    trackingId,
    orderId,
    versions: {
      nest: packageVersion(require, '@nestjs/core'),
      fastify: packageVersion(require, 'fastify'),
      expressAdapter: packageVersion(require, '@nestjs/platform-express'),
      express: packageVersion(
        createRequire(require.resolve('@nestjs/platform-express')),
        'express',
      ),
      mongo: info.version,
    },
  };
  process.send(ready);
} catch (error) {
  process.send?.({
    type: 'failed',
    error: error instanceof Error ? error.message : 'Isolated startup failed.',
  });
  await app?.close();
  process.exit(1);
}
