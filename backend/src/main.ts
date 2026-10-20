import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { allowedOrigins } from './common/cors.js';
import { configureDns } from './config/dns.js';
import { getRuntimeSettings } from './config/runtime-settings.js';

configureDns();

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(cors, {
    origin: allowedOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

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

void bootstrap();
