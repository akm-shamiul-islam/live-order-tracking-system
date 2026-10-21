import type { UserSummary } from '@kitchentodoor/shared';

export interface RuntimeReady {
  type: 'ready';
  base: string;
  token: string;
  user: UserSummary;
  trackingId: string;
  orderId: string;
  versions: {
    nest: string;
    fastify: string;
    expressAdapter: string;
    express: string;
    mongo: string;
  };
}

export type RuntimeMessage = RuntimeReady | { type: 'failed'; error: string };
export type RuntimeAdapter = 'fastify' | 'express';

export function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  if (!value || typeof value !== 'object' || !('type' in value)) return false;
  if (value.type === 'failed') return 'error' in value && typeof value.error === 'string';
  return (
    value.type === 'ready' &&
    'base' in value &&
    typeof value.base === 'string' &&
    'token' in value &&
    typeof value.token === 'string' &&
    'trackingId' in value &&
    typeof value.trackingId === 'string' &&
    'orderId' in value &&
    typeof value.orderId === 'string' &&
    'user' in value &&
    typeof value.user === 'object' &&
    value.user !== null &&
    'versions' in value &&
    typeof value.versions === 'object' &&
    value.versions !== null
  );
}
