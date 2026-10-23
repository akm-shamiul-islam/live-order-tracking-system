import type { FastifyRequest } from 'fastify';
import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  UserSummary,
} from '@kitchentodoor/shared';

export type AuthenticatedRequest = FastifyRequest & { user?: UserSummary };

interface SocketData {
  user?: UserSummary;
}

// This application does not currently emit inter-server events.
type InterServerEvents = Record<string, never>;

export type OrderSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
export type OrderSocketServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export function socketCredential(client: Pick<OrderSocket, 'handshake'>): unknown {
  // Socket.IO exposes handshake.auth as any. Treat client-supplied values as
  // unknown and narrow them before use; a generic alone cannot validate JSON.
  const auth: unknown = client.handshake.auth;
  const token = auth && typeof auth === 'object' && 'token' in auth ? auth.token : undefined;
  return token || client.handshake.headers.authorization;
}
