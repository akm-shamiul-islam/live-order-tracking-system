// Only the test/benchmark parent starts this child. It never reads or writes the configured development database.
import 'reflect-metadata';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
if (
  !process.send ||
  process.env.KTD_ISOLATED_RUN !== 'true' ||
  !/^mongodb:\/\/127\.0\.0\.1:\d+\/ktd_/.test(process.env.MONGODB_URI || '')
) {
  throw new Error('This server requires an isolated test database and an IPC parent.');
}
const { NestFactory } = require('@nestjs/core');
const { getModelToken } = require('@nestjs/mongoose');
const { UserRole, OrderStatus } = await import('@kitchentodoor/shared');
const { User } = await import('../dist/database/schemas/user.schema.js');
const { Order } = await import('../dist/database/schemas/order.schema.js');
const { AuthSession } = await import('../dist/database/schemas/auth-session.schema.js');
const { OrdersService } = await import('../dist/orders/orders.service.js');
const { AuthService } = await import('../dist/auth/auth.service.js');
const { allowedOrigins } = await import('../dist/common/cors.js');
const { BoundedSocketAdapter } = await import('../dist/common/socket-adapter.js');
const bcrypt = require('bcryptjs');
let app;
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await app?.close();
  process.exit(0);
}
process.on('message', (message) => {
  if (message.type === 'stop') void close();
});
process.on('disconnect', () => void close());
process.on('SIGTERM', () => void close());
try {
  if (process.env.KTD_ADAPTER === 'express') {
    const { AppModule } = await import('../dist/app.module.js');
    const { ExpressAdapter } = require('@nestjs/platform-express');
    app = await NestFactory.create(AppModule, new ExpressAdapter(), {
      logger: false,
      abortOnError: false,
    });
    app.use(
      require('helmet')({
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
    const { isTrustedProxy } = await import('../dist/common/client-address.js');
    app
      .getHttpAdapter()
      .getInstance()
      .set('trust proxy', (address) => isTrustedProxy(address));
    app.useWebSocketAdapter(new BoundedSocketAdapter(app));
    await app.init();
  } else {
    const { createApplication } = await import('../dist/bootstrap.js');
    app = await createApplication(true);
  }
  await app.listen(Number(process.env.KTD_LISTEN_PORT || 0), '127.0.0.1');
  const users = app.get(getModelToken(User.name));
  const orders = app.get(getModelToken(Order.name));
  const sessions = app.get(getModelToken(AuthSession.name));
  await Promise.all([users.init(), orders.init(), sessions.init()]);
  let first;
  if (process.env.KTD_SEED === 'true') {
    const passwordHash = await bcrypt.hash(process.env.KTD_TEST_PASSWORD, 10);
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
  const auth = await app
    .get(AuthService)
    .login({ email: 'dispatcher@example.test', password: process.env.KTD_TEST_PASSWORD });
  const info = await users.db.db.admin().command({ buildInfo: 1 });
  process.send({
    type: 'ready',
    base: await app.getUrl(),
    token: auth.accessToken,
    user: auth.user,
    trackingId: first?.trackingId || process.env.KTD_TRACKING_ID,
    orderId: first?.id || process.env.KTD_ORDER_ID,
    versions: {
      nest: require('@nestjs/core/package.json').version,
      fastify: require('fastify/package.json').version,
      expressAdapter: require('@nestjs/platform-express/package.json').version,
      express: createRequire(require.resolve('@nestjs/platform-express'))('express/package.json')
        .version,
      mongo: info.version,
    },
  });
} catch (error) {
  process.send?.({ type: 'failed', error: error.message });
  await app?.close();
  process.exit(1);
}
