import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { configureDns } from './config/dns.js';
import { getRuntimeSettings } from './config/runtime-settings.js';
import { createApplication } from './bootstrap.js';

configureDns();

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await createApplication();
  app.enableShutdownHooks();

  const { PORT: port, API_HOST: host } = getRuntimeSettings();
  await app.listen(port, host);

  logger.log(`
╔══════════════════════════════════════════════════════════════════╗
║  🍳 KitchenToDoor Fastify Backend Running                       ║
║  📡 Port: ${port}                                                   ║
║  🌐 HTTP: http://localhost:${port}                                  ║
║  ⚡ WebSocket: ws://localhost:${port}                               ║
║  🛡️ Auth: JWT + Bcryptjs + WsJwtGuard Handshake                  ║
╚══════════════════════════════════════════════════════════════════╝
  `);
}

void bootstrap().catch(() => {
  new Logger('Bootstrap').error(
    'API startup failed. Check database reachability, MONGODB_URI, JWT_SECRET and the configured ports.',
  );
  process.exitCode = 1;
});
