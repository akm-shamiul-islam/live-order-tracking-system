import type { RuntimeSettings } from '../config/runtime-settings.js';

type Counter = { count: number; expiresAt: number };
type Settings = Pick<
  RuntimeSettings,
  | 'SOCKET_RATE_LIMIT_WINDOW_MS'
  | 'SOCKET_RATE_LIMIT_MAX'
  | 'SOCKET_IP_RATE_LIMIT_MAX'
  | 'SOCKET_RATE_LIMIT_IPS_MAX'
>;

export class SocketRateLimiter {
  private connections = new Map<string, Counter>();
  private addresses = new Map<string, Counter>();
  private pruneAt = 0;

  constructor(private readonly settings: () => Settings) {}

  consume(connection: string, address: string, now = Date.now()): boolean {
    const settings = this.settings();
    if (now >= this.pruneAt) {
      for (const counters of [this.connections, this.addresses]) {
        for (const [key, value] of counters) if (value.expiresAt <= now) counters.delete(key);
      }
      this.pruneAt = now + settings.SOCKET_RATE_LIMIT_WINDOW_MS;
    }
    let ip = this.addresses.get(address);
    if (!ip || ip.expiresAt <= now) {
      if (!ip && this.addresses.size >= settings.SOCKET_RATE_LIMIT_IPS_MAX) return false;
      ip = { count: 0, expiresAt: now + settings.SOCKET_RATE_LIMIT_WINDOW_MS };
      this.addresses.set(address, ip);
    }
    if (++ip.count > settings.SOCKET_IP_RATE_LIMIT_MAX) return false;
    let peer = this.connections.get(connection);
    if (!peer || peer.expiresAt <= now) {
      peer = { count: 0, expiresAt: now + settings.SOCKET_RATE_LIMIT_WINDOW_MS };
      this.connections.set(connection, peer);
    }
    return ++peer.count <= settings.SOCKET_RATE_LIMIT_MAX;
  }

  disconnect(connection: string) {
    this.connections.delete(connection);
  }
}
