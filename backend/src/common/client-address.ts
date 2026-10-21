import { isIP } from 'node:net';
import type { IncomingMessage } from 'node:http';
import { getRuntimeSettings } from '../config/runtime-settings.js';

const normalize = (address: string) =>
  address.startsWith('::ffff:') && isIP(address.slice(7)) === 4 ? address.slice(7) : address;

export function isTrustedProxy(
  address: string,
  trusted = getRuntimeSettings().TRUSTED_PROXY_IPS,
): boolean {
  return trusted.some((entry) => normalize(entry) === normalize(address));
}

export function resolveClientAddress(
  peer: string,
  forwarded: string | undefined,
  trusted: string[],
): string {
  let address = normalize(peer);
  if (!isTrustedProxy(address, trusted) || !forwarded) return address;
  const chain = forwarded.split(',').map((entry) => normalize(entry.trim()));
  if (chain.some((entry) => isIP(entry) === 0)) return address;
  // Walk from our socket peer toward the client, stopping at the first untrusted hop.
  for (let index = chain.length - 1; index >= 0 && isTrustedProxy(address, trusted); index--)
    address = chain[index]!;
  return address;
}

export function clientAddress(request: IncomingMessage): string {
  const header = request.headers['x-forwarded-for'];
  return resolveClientAddress(
    request.socket.remoteAddress || 'unknown',
    typeof header === 'string' ? header : undefined,
    getRuntimeSettings().TRUSTED_PROXY_IPS,
  );
}
