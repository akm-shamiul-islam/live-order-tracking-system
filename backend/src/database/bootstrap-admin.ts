import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { SeedService } from './seed.service.js';
import { configureDns } from '../config/dns.js';

async function bootstrap() {
  if (process.env.NODE_ENV !== 'production')
    throw new Error(
      'This command requires NODE_ENV=production. Development staff are created by pnpm dev.',
    );
  configureDns();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
    abortOnError: false,
  });
  try {
    await app.get(SeedService).bootstrapAdministrator();
    console.log(
      'Initial administrator created. Remove BOOTSTRAP_ADMIN_PASSWORD from the environment, then sign in and manage accounts through Users.',
    );
  } finally {
    await app.close();
  }
}
void bootstrap().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Initial administrator creation failed.');
  process.exitCode = 1;
});
