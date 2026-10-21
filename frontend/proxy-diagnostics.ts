import { createLogger, type ProxyOptions, type Logger } from 'vite';

export function createProxyDiagnostics(target: string): {
  logger: Logger;
  configure: NonNullable<ProxyOptions['configure']>;
} {
  const logger = createLogger();
  const defaultError = logger.error.bind(logger);
  const reported = new Set<string>();
  const address = new URL(target).origin;
  logger.error = (message, options) => {
    const error = options?.error;
    const code =
      error && 'code' in error && typeof error.code === 'string' ? error.code : undefined;
    if (
      !/\b(?:ws|http) proxy error:/.test(message) ||
      !code ||
      !['ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'ENOTFOUND'].includes(code)
    ) {
      defaultError(message, options);
      return;
    }
    if (reported.has(code)) return;
    reported.add(code);
    const explanation =
      code === 'ECONNREFUSED'
        ? `API ${address} is not reachable. Start both servers with pnpm dev and check PORT/API_PROXY_TARGET. Live updates reconnect when the API is ready.`
        : code === 'ENOTFOUND'
          ? `API host ${address} could not be resolved. Check API_PROXY_TARGET and DNS.`
          : `Live connection to ${address} closed (${code}). This can happen during API restarts or page reloads. The client reconnects automatically.`;
    logger.warn(explanation, { timestamp: true });
  };
  const configure: NonNullable<ProxyOptions['configure']> = (proxy) => {
    proxy.on('open', () => reported.clear());
  };
  return { logger, configure };
}
