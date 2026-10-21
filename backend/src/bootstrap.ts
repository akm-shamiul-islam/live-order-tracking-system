import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import { AppModule } from './app.module.js';
import { allowedOrigins } from './common/cors.js';
import { BoundedSocketAdapter } from './common/socket-adapter.js';
import {
  registerFrontend,
  FrontendHttpAdapter,
  frontendScriptSources,
} from './common/frontend-hosting.js';
import { getRuntimeSettings } from './config/runtime-settings.js';
import { isTrustedProxy } from './common/client-address.js';

export async function createApplication(quiet = false) {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FrontendHttpAdapter({ logger: false, trustProxy: (address) => isTrustedProxy(address) }),
    { abortOnError: false, ...(quiet ? { logger: false } : {}) },
  );
  app.useWebSocketAdapter(new BoundedSocketAdapter(app));
  const settings = getRuntimeSettings();
  await app.register(helmet, {
    contentSecurityPolicy: settings.SERVE_FRONTEND
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: frontendScriptSources(),
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:'],
            fontSrc: ["'self'"],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: settings.PUBLIC_APP_URL.startsWith('https://') ? [] : null,
          },
        }
      : false,
    referrerPolicy: { policy: 'no-referrer' },
    crossOriginEmbedderPolicy: true,
  });
  await app.register(cors, {
    origin: allowedOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  await registerFrontend(app);
  await app.init();
  return app;
}
