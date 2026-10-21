import { describe, expect, it } from 'vitest';
import { resolveClientAddress } from './client-address.js';

describe('Trusted proxy client addresses', () => {
  it('ignores spoofed forwarding headers from untrusted peers', () => {
    expect(resolveClientAddress('203.0.113.9', '198.51.100.1', [])).toBe('203.0.113.9');
    expect(resolveClientAddress('203.0.113.9', '198.51.100.1', ['127.0.0.1'])).toBe('203.0.113.9');
  });
  it('uses the first untrusted hop from the right, ignoring a client-supplied prefix', () => {
    expect(resolveClientAddress('127.0.0.1', '198.51.100.1,203.0.113.9', ['127.0.0.1'])).toBe(
      '203.0.113.9',
    );
    expect(
      resolveClientAddress('127.0.0.1', '198.51.100.1,10.0.0.2', ['127.0.0.1', '10.0.0.2']),
    ).toBe('198.51.100.1');
  });
  it('normalizes mapped IPv4 and falls back safely for malformed headers', () => {
    expect(resolveClientAddress('::ffff:127.0.0.1', '203.0.113.9', ['127.0.0.1'])).toBe(
      '203.0.113.9',
    );
    expect(resolveClientAddress('127.0.0.1', 'not-an-ip,203.0.113.9', ['127.0.0.1'])).toBe(
      '127.0.0.1',
    );
  });
});
