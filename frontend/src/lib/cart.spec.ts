import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MENU_ITEMS } from '@kitchentodoor/shared';
import { addCartItem, cartStore, readCart, synchronizeCart } from './cart';

const memory = new Map<string, string>();
const localStorageMock = {
  get length() {
    return memory.size;
  },
  clear: () => memory.clear(),
  getItem: (key: string) => memory.get(key) ?? null,
  key: (index: number) => [...memory.keys()][index] ?? null,
  removeItem: (key: string) => memory.delete(key),
  setItem: (key: string, value: string) => memory.set(key, value),
} as Storage;

const firstItem = MENU_ITEMS[0];
const customerA = '64f1a2b3c4d5e6f7a8b9c0d1';
const customerB = '74f1a2b3c4d5e6f7a8b9c0d2';

describe('cart store', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock);
    memory.clear();
    cartStore.setState({ owner: 'guest', items: [] });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('persists canonical menu quantities and ignores forged prices in storage', () => {
    expect(firstItem).toBeDefined();
    if (!firstItem) return;

    localStorageMock.setItem(
      `ktd_cart_v1:${customerA}`,
      JSON.stringify({
        version: 1,
        items: [
          { id: firstItem.id, quantity: 2, price: 0.01 },
          { id: 'unknown', quantity: 9 },
        ],
      }),
    );

    expect(readCart(customerA)).toEqual([{ ...firstItem, quantity: 2 }]);
  });

  it('keeps customer carts separate and adopts a guest cart on sign in', () => {
    expect(firstItem).toBeDefined();
    if (!firstItem) return;

    addCartItem(undefined, firstItem);
    synchronizeCart(customerA);
    expect(readCart(customerA)).toEqual([{ ...firstItem, quantity: 1 }]);
    expect(readCart()).toEqual([]);

    addCartItem(customerB, firstItem);
    expect(readCart(customerA)).toEqual([{ ...firstItem, quantity: 1 }]);
    expect(readCart(customerB)).toEqual([{ ...firstItem, quantity: 1 }]);
  });
});
