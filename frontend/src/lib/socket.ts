import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '@kitchentodoor/shared';
import { getSession } from './authSession';
import { clientSettings } from './clientSettings';

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

export function getSocket(token?: string | null): TypedSocket {
  const currentToken = token === undefined ? getSession().token : token;
  const nextAuth = currentToken ? { token: currentToken } : {};
  if (!socket) {
    socket = io(window.location.origin, {
      path: '/socket.io',
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: clientSettings.VITE_SOCKET_RECONNECT_ATTEMPTS,
      reconnectionDelay: clientSettings.VITE_SOCKET_RECONNECT_DELAY_MS,
      auth: nextAuth,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('⚡ Connected to KitchenToDoor WebSocket:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from KitchenToDoor WebSocket:', reason);
    });
  }

  // Update token if changed
  if (
    typeof socket.auth !== 'function' &&
    socket.auth.token !== currentToken &&
    (socket.auth.token || currentToken)
  ) {
    socket.auth = nextAuth;
    socket.disconnect().connect();
  }

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
