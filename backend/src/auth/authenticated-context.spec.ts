import { describe, expect, it } from 'vitest';
import { socketCredential, type OrderSocket } from './authenticated-context.js';

describe('Socket handshake boundary', () => {
  it.each([
    [{ token: 'Bearer access-token' }, undefined, 'Bearer access-token'],
    [undefined, 'Bearer header-token', 'Bearer header-token'],
    ['malformed-auth', undefined, undefined],
    [null, undefined, undefined],
    [{ token: { role: 'ADMIN' } }, undefined, { role: 'ADMIN' }],
  ])(
    'keeps credentials unknown until the guard validates them',
    (auth, authorization, expected) => {
      // Malformed network input deliberately violates Socket.IO's declared shape.
      const handshake = { auth, headers: { authorization } } as unknown as OrderSocket['handshake'];
      expect(socketCredential({ handshake })).toEqual(expected);
    },
  );
});
