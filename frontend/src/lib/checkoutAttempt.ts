import type { CreateOrderDto } from '@kitchentodoor/shared';

interface CheckoutAttempt {
  ownerId: string;
  digest: string;
  key: string;
}

const storageKey = 'ktd_checkout_attempt';
let current: CheckoutAttempt | undefined;

export async function getCheckoutAttempt(
  ownerId: string,
  dto: CreateOrderDto,
): Promise<CheckoutAttempt> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(dto)));
  const digest = Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    if (
      saved &&
      typeof saved === 'object' &&
      'ownerId' in saved &&
      typeof saved.ownerId === 'string' &&
      'digest' in saved &&
      typeof saved.digest === 'string' &&
      'key' in saved &&
      typeof saved.key === 'string' &&
      /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(saved.key)
    ) {
      current = { ownerId: saved.ownerId, digest: saved.digest, key: saved.key };
    }
  } catch {
    /* Keep the in-memory attempt when session storage is unavailable. */
  }
  if (current?.ownerId === ownerId && current.digest === digest) return current;
  current = { ownerId, digest, key: crypto.randomUUID() };
  try {
    // Store only an opaque key and a digest, never addresses, contact details, or cart contents.
    sessionStorage.setItem(storageKey, JSON.stringify(current));
  } catch {
    /* In-memory retries still use the same key. */
  }
  return current;
}

export function completeCheckoutAttempt(key: string) {
  if (current?.key === key) current = undefined;
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    if (stored && typeof stored === 'object' && 'key' in stored && stored.key === key) {
      sessionStorage.removeItem(storageKey);
    }
  } catch {
    /* Storage may be blocked. */
  }
}
