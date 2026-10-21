import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import staticFiles from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { getRuntimeSettings } from '../config/runtime-settings.js';

export function frontendScriptSources(): string[] {
  const path = fileURLToPath(new URL('../../../frontend/dist/index.html', import.meta.url));
  if (!existsSync(path)) throw new Error('Build the frontend before enabling SERVE_FRONTEND.');
  const match = /<script\s+id="theme-init">([\s\S]*?)<\/script>/.exec(readFileSync(path, 'utf8'));
  if (!match)
    throw new Error(
      'The built frontend is missing its theme initialization script. Rebuild all packages.',
    );
  return ["'self'", `'sha256-${createHash('sha256').update(match[1]!).digest('base64')}'`];
}

export async function registerFrontend(app: NestFastifyApplication) {
  const settings = getRuntimeSettings();
  if (!settings.SERVE_FRONTEND) return;
  const root = fileURLToPath(new URL('../../../frontend/dist/', import.meta.url));
  if (!existsSync(`${root}/index.html`))
    throw new Error('Build the frontend before enabling SERVE_FRONTEND.');
  await app.register(staticFiles, {
    root,
    index: false,
    preCompressed: true,
    setHeaders(response, filePath) {
      const normalized = filePath.replaceAll('\\', '/');
      response.header(
        'Cache-Control',
        /\/(?:index\.html|theme\.js)(?:\.(?:br|gz))?$/.test(normalized)
          ? 'no-store'
          : normalized.includes('/assets/') ||
              /-[a-f0-9]{8}(?:-\d+)?\.(?:webp|woff2)$/.test(normalized)
            ? `public, max-age=${settings.STATIC_HASHED_MAX_AGE_SECONDS}, immutable`
            : `public, max-age=${settings.STATIC_ASSET_MAX_AGE_SECONDS}`,
      );
    },
  });
}

export class FrontendHttpAdapter extends FastifyAdapter {
  override setNotFoundHandler(handler: Parameters<FastifyAdapter['setNotFoundHandler']>[0]) {
    if (!getRuntimeSettings().SERVE_FRONTEND) return super.setNotFoundHandler(handler);
    // Nest installs the not-found handler once. Extend that hook rather than registering it twice.
    return super.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
      const path = request.url.split('?')[0]!;
      const html =
        !request.headers.accept ||
        request.headers.accept.includes('text/html') ||
        request.headers.accept.includes('*/*');
      if (
        (request.method === 'GET' || request.method === 'HEAD') &&
        html &&
        path !== '/api' &&
        !path.startsWith('/api/') &&
        !path.startsWith('/socket.io') &&
        !path.split('/').at(-1)?.includes('.')
      ) {
        const known =
          /^\/(?:$|orders\/?$|users\/?$|dispatch\/?$|(?:tracking|courier)(?:\/[^/]+)?\/?$|account(?:\/(?:register|forgot|reset))?\/?$)/.test(
            path,
          );
        return reply.code(known ? 200 : 404).sendFile('index.html');
      }
      return handler(request, reply);
    });
  }
}
