import 'reflect-metadata';
import { fork, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { JwtService } from '@nestjs/jwt';
import { isRuntimeMessage, type RuntimeAdapter, type RuntimeReady } from './runtime-contracts.ts';
import { createTestSmtpServer } from '../src/testing/test-smtp.js';

export { io, type Socket } from 'socket.io-client';
const root = fileURLToPath(new URL('../../', import.meta.url));

export async function unusedPort() {
  const listener = createServer();
  await new Promise<void>((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const address = listener.address();
  if (!address || typeof address === 'string')
    throw new Error('No isolated TCP port was assigned.');
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    listener.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

interface RuntimeOptions {
  count?: number;
  rateLimit?: number;
  serveFrontend?: boolean;
  extraOrigins?: string[];
}

export async function createIsolatedRuntime({
  count = 100,
  rateLimit = 1_000_000,
  serveFrontend = false,
  extraOrigins = [],
}: RuntimeOptions = {}) {
  const mongo = await MongoMemoryServer.create({
    binary: { downloadDir: join(tmpdir(), 'ktd-mongo-binaries') },
  });
  const smtp = await createTestSmtpServer();

  const password = `Test-${randomBytes(20).toString('hex')}!`;
  const jwtSecret = randomBytes(32).toString('hex');
  function expireAccessToken(token: string) {
    const jwt = new JwtService({ secret: jwtSecret });
    const { iat: _iat, exp: _exp, ...claims } = jwt.verify<Record<string, unknown>>(token);
    return jwt.sign(claims, { expiresIn: -1 });
  }
  const children: ChildProcess[] = [];
  const running = new Map<string, ChildProcess>();
  let fixture: RuntimeReady | undefined;
  async function start(adapter: RuntimeAdapter = 'fastify', options: { port?: number } = {}) {
    const port = options.port ?? (await unusedPort());
    const origin = `http://127.0.0.1:${port}`;
    const child = fork(join(root, 'backend/scripts/isolated-server.ts'), [], {
      cwd: root,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        KTD_ISOLATED_RUN: 'true',
        KTD_ADAPTER: adapter,
        KTD_LISTEN_PORT: String(port),
        KTD_SEED: fixture ? 'false' : 'true',
        KTD_FIXTURE_ORDERS: String(count),
        KTD_TEST_PASSWORD: password,
        KTD_TRACKING_ID: fixture?.trackingId || '',
        KTD_ORDER_ID: fixture?.orderId || '',
        MONGODB_URI: mongo.getUri('ktd_runtime'),
        JWT_SECRET: jwtSecret,
        JWT_EXPIRES_IN: '15m',
        DNS_SERVERS: '',
        SMTP_HOST: smtp.host,
        SMTP_PORT: String(smtp.port),
        SMTP_SECURE: 'false',
        SMTP_REQUIRE_TLS: 'false',
        SMTP_USER: smtp.user,
        SMTP_PASSWORD: smtp.password,
        SMTP_FROM: smtp.from,
        AUTH_OTP_TTL_SECONDS: '600',
        AUTH_OTP_RESEND_SECONDS: '60',
        AUTH_COOKIE_SECURE: 'false',
        SERVE_FRONTEND: serveFrontend ? 'true' : 'false',
        PUBLIC_APP_URL: origin,
        FRONTEND_URL: [origin, ...extraOrigins].join(','),
        RATE_LIMIT_MAX: String(rateLimit),
        LOGIN_RATE_LIMIT_MAX: String(rateLimit),
        REGISTER_RATE_LIMIT_MAX: String(rateLimit),
        PROFILE_CHANGE_RATE_LIMIT_MAX: String(rateLimit),
        SOCKET_CONNECT_MAX: '200',
        SOCKET_CONNECTIONS_PER_IP_MAX: '100',
        MONGODB_SERVER_SELECTION_TIMEOUT_MS: '2000',
        MONGODB_RETRY_ATTEMPTS: '0',
      },
    });
    children.push(child);
    let logs = '';
    child.stdout?.on('data', (data: Buffer) => {
      logs = (logs + data).slice(-2000);
    });
    child.stderr?.on('data', (data: Buffer) => {
      logs = (logs + data).slice(-2000);
    });
    const ready = await new Promise<RuntimeReady>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Isolated ${adapter} startup timed out.`)),
        60_000,
      );
      child.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once('exit', (code) => {
        clearTimeout(timeout);
        reject(new Error(`Isolated ${adapter} exited (${code}). ${logs}`));
      });
      child.on('message', (message: unknown) => {
        if (!isRuntimeMessage(message)) return;
        if (message.type === 'ready') {
          clearTimeout(timeout);
          resolve(message);
        }
        if (message.type === 'failed') {
          clearTimeout(timeout);
          reject(new Error(message.error));
        }
      });
    });
    fixture ??= ready;
    running.set(ready.base, child);
    return { ...ready, password };
  }
  async function stopChild(child: ChildProcess) {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit');
    if (child.connected) child.send({ type: 'stop' });
    const timer = setTimeout(() => child.kill(), 5000);
    await exited.finally(() => clearTimeout(timer));
  }
  async function stop(base: string) {
    const child = running.get(base);
    if (!child) throw new Error('Only this harness’s own server may be stopped.');
    await stopChild(child);
    running.delete(base);
  }
  async function close() {
    await Promise.all(children.map(stopChild));
    await mongo.stop();
    await smtp.close();
  }
  return { start, stop, close, count, expireAccessToken, takeOtp: smtp.takeOtp };
}
