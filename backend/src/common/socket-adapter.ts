import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';
import { getRuntimeSettings } from '../config/runtime-settings.js';
import { SocketRateLimiter } from './socket-rate-limiter.js';
import { isAllowedOrigin } from './cors.js';
import { clientAddress } from './client-address.js';

export class BoundedSocketAdapter extends IoAdapter {
  private readonly activeAddresses = new Map<string, number>();
  private readonly attempts = new SocketRateLimiter(() => {
    const settings = getRuntimeSettings();
    return {
      ...settings,
      SOCKET_RATE_LIMIT_WINDOW_MS: settings.SOCKET_CONNECT_WINDOW_MS,
      SOCKET_RATE_LIMIT_MAX: settings.SOCKET_CONNECT_MAX,
      SOCKET_IP_RATE_LIMIT_MAX: settings.SOCKET_CONNECT_MAX,
    };
  });

  override createIOServer(port: number, options?: ServerOptions) {
    // Socket.IO merges these partial options with its defaults; Nest types this as ServerOptions.
    const settings = getRuntimeSettings();
    const server = super.createIOServer(port, {
      ...options,
      maxHttpBufferSize: settings.SOCKET_MAX_PAYLOAD_BYTES,
      allowRequest: (request, callback) => {
        const ip = clientAddress(request);
        if (!isAllowedOrigin(request.headers.origin))
          return callback('Origin is not allowed', false);
        if (
          !this.attempts.consume(ip, ip) ||
          server.engine.clientsCount >= settings.SOCKET_CONNECTIONS_MAX ||
          (this.activeAddresses.get(ip) ?? 0) >= settings.SOCKET_CONNECTIONS_PER_IP_MAX
        ) {
          return callback('Too many connections. Please wait before reconnecting.', false);
        }
        if (options?.allowRequest) return options.allowRequest(request, callback);
        callback(null, true);
      },
    } as ServerOptions);
    server.engine.on('connection', (connection) => {
      const ip = clientAddress(connection.request);
      const count = this.activeAddresses.get(ip) ?? 0;
      // Concurrent handshakes can pass admission before another handshake has completed.
      if (
        count >= settings.SOCKET_CONNECTIONS_PER_IP_MAX ||
        server.engine.clientsCount > settings.SOCKET_CONNECTIONS_MAX
      ) {
        connection.close();
        return;
      }
      this.activeAddresses.set(ip, count + 1);
      connection.once('close', () => {
        const next = (this.activeAddresses.get(ip) ?? 1) - 1;
        if (next > 0) this.activeAddresses.set(ip, next);
        else this.activeAddresses.delete(ip);
      });
    });
    return server;
  }
}
