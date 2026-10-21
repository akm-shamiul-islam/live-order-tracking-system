import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '@kitchentodoor/shared';
import { getSession, subscribeSession } from './authSession';
import { api } from './api';
import { clientSettings } from './clientSettings';

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;
let unsubscribeIdentity: (() => void) | undefined;

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
      transports: ['polling', 'websocket'],
      tryAllTransports: true,
    });
    unsubscribeIdentity = subscribeSession(() => {
      getSocket(getSession().token);
    });

    socket.on('connect', () => {
      console.log('⚡ Connected to KitchenToDoor WebSocket:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from KitchenToDoor WebSocket:', reason);
    });
    socket.on('error', (error) => {
      if (
        error.code === 'UNAUTHORIZED' &&
        socket &&
        typeof socket.auth !== 'function' &&
        socket.auth.token === getSession().token
      )
        void api.auth.getMe().catch(() => undefined);
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
  unsubscribeIdentity?.();
  unsubscribeIdentity = undefined;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Vite replaces this module during development; dispose its connection before the replacement connects.
if (import.meta.hot) import.meta.hot.dispose(disconnectSocket);
