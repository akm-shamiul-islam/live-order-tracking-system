import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WsException } from '@nestjs/websockets';
import { UserRole, type UserSummary } from '@kitchentodoor/shared';
import { RolesGuard } from './roles.guard.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

const admin: UserSummary = {
  id: '64f1a2b3c4d5e6f7a8b9c0d1',
  name: 'Administrator',
  email: 'admin@example.test',
  role: UserRole.ADMIN,
};

function context(kind: 'http' | 'ws', user?: UserSummary, legacyUser?: UserSummary) {
  const handler = () => undefined;
  Reflect.defineMetadata(ROLES_KEY, [UserRole.ADMIN], handler);
  // Only the framework methods used by this guard are doubled; integration
  // coverage exercises actual Nest HTTP/WebSocket execution contexts.
  return {
    getHandler: () => handler,
    getClass: () => RolesGuard,
    getType: () => kind,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    switchToWs: () => ({ getClient: () => ({ data: { user }, user: legacyUser }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard authenticated contexts', () => {
  const guard = new RolesGuard(new Reflector());

  it.each(['http', 'ws'] as const)('permits the current administrator over %s', (kind) => {
    expect(guard.canActivate(context(kind, admin))).toBe(true);
  });

  it.each(['http', 'ws'] as const)('rejects a customer over %s', (kind) => {
    expect(() => guard.canActivate(context(kind, { ...admin, role: UserRole.CUSTOMER }))).toThrow(
      kind === 'http' ? ForbiddenException : WsException,
    );
  });

  it.each(['http', 'ws'] as const)('rejects an absent actor over %s', (kind) => {
    expect(() => guard.canActivate(context(kind))).toThrow(
      kind === 'http' ? ForbiddenException : WsException,
    );
  });

  it('does not trust a legacy ad-hoc socket.user property', () => {
    expect(() => guard.canActivate(context('ws', undefined, admin))).toThrow(WsException);
  });
});
