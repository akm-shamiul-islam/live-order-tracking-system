import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { ClientSettingsSchema, FrontendPortSchema } from './src/lib/client-settings-schema.ts';
import { createProxyDiagnostics } from './proxy-diagnostics.ts';

export default defineConfig(({ mode }) => {
  // Read proxy and allowlisted public settings; loading the backend's NODE_ENV through Vite's
  // loadEnv would change production builds into development builds.
  const env: Record<string, string> = {};
  for (const filename of ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`]) {
    const path = new URL(`../${filename}`, import.meta.url);
    if (existsSync(path)) Object.assign(env, parseEnv(readFileSync(path, 'utf8')));
  }
  const target =
    process.env.API_PROXY_TARGET ||
    env.API_PROXY_TARGET ||
    `http://127.0.0.1:${process.env.PORT || env.PORT || 5000}`;
  const diagnostics = createProxyDiagnostics(target);
  const proxy = {
    '/api': { target, changeOrigin: true },
    '/socket.io': { target, ws: true, configure: diagnostics.configure },
  };
  const browserSettings = ClientSettingsSchema.parse(
    Object.fromEntries(
      Object.keys(ClientSettingsSchema.shape).map((key) => [key, process.env[key] ?? env[key]]),
    ),
  );
  return {
    customLogger: diagnostics.logger,
    // Only explicitly public settings enter the bundle; backend secrets stay on the server.
    define: Object.fromEntries(
      Object.entries(browserSettings).map(([key, value]) => [
        `import.meta.env.${key}`,
        JSON.stringify(value),
      ]),
    ),
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'vite-plugin-theme-init',
        transformIndexHtml(html) {
          const code = readFileSync(new URL('./public/theme.js', import.meta.url), 'utf8');
          return html.replace(
            '<script src="/theme.js"></script>',
            `<script id="theme-init">${code}</script>`,
          );
        },
      },
    ],
    server: {
      port: FrontendPortSchema.parse(process.env.FRONTEND_PORT ?? env.FRONTEND_PORT),
      proxy,
    },
    preview: { proxy },
  };
});
