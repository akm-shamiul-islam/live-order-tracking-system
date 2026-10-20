import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { SeedService } from './seed.service.js';
import { configureDns } from '../config/dns.js';

async function resetDevelopmentAdmin() {
  // ConfigModule has loaded the environment before creating the application context.
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('This command requires NODE_ENV=development.');
  }
  configureDns();
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    await app.get(SeedService).resetDevelopmentAdmin();
    console.log(
      'Development admin restored. Sign in with ADMIN_DEFAULT_EMAIL and ADMIN_DEFAULT_PASSWORD from .env.',
    );
  } finally {
    await app.close();
  }
}

void resetDevelopmentAdmin().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Development admin reset failed.');
  process.exitCode = 1;
});
