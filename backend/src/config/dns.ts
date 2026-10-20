import dns from 'node:dns';
import { getRuntimeSettings } from './runtime-settings.js';

export function configureDns() {
  const servers = getRuntimeSettings().DNS_SERVERS;
  if (servers.length) dns.setServers([...servers, ...dns.getServers()]);
}
