import { MENU_ITEMS, type MenuItem } from '@kitchentodoor/shared';
import { createStore } from 'zustand/vanilla';
import { getSession } from './authSession';

export interface CartItem extends MenuItem {
  quantity: number;
}

interface StoredCart {
  version: 1;
  items: Array<{ id: string; quantity: number }>;
}

const CART_VERSION = 1;
const ownerKey = (ownerId?: string) =>
  ownerId && /^[a-f\d]{24}$/i.test(ownerId) ? ownerId.toLowerCase() : 'guest';
const storageKey = (ownerId?: string) => `ktd_cart_v${CART_VERSION}:${ownerKey(ownerId)}`;

function canonicalCart(items: unknown): CartItem[] {
  if (!Array.isArray(items)) return [];
  const quantities = new Map<string, number>();
  const values: unknown[] = items.map((value: unknown) => value);
  for (const item of values) {
    if (typeof item !== 'object' || item === null || !('id' in item) || !('quantity' in item))
      continue;
    const { id, quantity } = item;
    if (
      typeof id !== 'string' ||
      typeof quantity !== 'number' ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 99
    )
      continue;
    const menuItem = MENU_ITEMS.find((entry) => entry.id === id);
    if (!menuItem) continue;
    quantities.set(menuItem.id, Math.min(99, (quantities.get(menuItem.id) ?? 0) + quantity));
  }
  return MENU_ITEMS.flatMap((item) => {
    const quantity = quantities.get(item.id);
    return quantity ? [{ ...item, quantity }] : [];
  });
}

interface CartState {
  owner: string;
  items: CartItem[];
}

const ownerId = (id?: string) => (id && /^[a-f\d]{24}$/i.test(id) ? id.toLowerCase() : undefined);
const owner = (id?: string) => ownerId(id) ?? 'guest';
function claimGuestCart(id: string, guestItems = readCart()): CartItem[] {
  if (guestItems.length === 0) return readCart(id);
  const merged = canonicalCart([...readCart(id), ...guestItems]);
  if (!writeCart(id, merged)) return merged;
  try {
    localStorage.removeItem(storageKey());
  } catch {
    // A guest cart that cannot be removed does not affect the signed-in account's scoped cart.
  }
  return merged;
}

const initialUserId = ownerId(getSession().user?.id);
const activeOwner = owner(initialUserId);

export const cartStore = createStore<CartState>()(() => ({
  owner: activeOwner,
  items: initialUserId ? claimGuestCart(initialUserId) : readCart(),
}));

function mutateCart(id: string | undefined, update: (items: CartItem[]) => CartItem[]): CartItem[] {
  const active = owner(id);
  const current = cartStore.getState();
  const items = current.owner === active ? current.items : readCart(id);
  const next = canonicalCart(update(items));
  writeCart(id, next);
  cartStore.setState({ owner: active, items: next });
  return next;
}

export function synchronizeCart(id?: string): void {
  const active = owner(id);
  const current = cartStore.getState();
  if (current.owner === active) return;
  const authenticatedId = ownerId(id);
  const items = authenticatedId
    ? current.owner === 'guest'
      ? claimGuestCart(authenticatedId, current.items)
      : readCart(authenticatedId)
    : readCart();
  cartStore.setState({ owner: active, items });
}

export function synchronizeCartStorage(event: StorageEvent, id?: string): void {
  const active = owner(id);
  if (cartStore.getState().owner !== active) return;
  if (event.key !== null && event.key !== storageKey(id)) return;
  cartStore.setState({ owner: active, items: readCart(id) });
}

export function addCartItem(id: string | undefined, item: MenuItem): void {
  mutateCart(id, (items) => updateCartItem(items, item.id, 1));
}

export function changeCartQuantity(
  id: string | undefined,
  menuItemId: string,
  delta: number,
): void {
  mutateCart(id, (items) => updateCartItem(items, menuItemId, delta));
}

export function removeCartItem(id: string | undefined, menuItemId: string): void {
  mutateCart(id, (items) => items.filter((item) => item.id !== menuItemId));
}

export function clearCart(id?: string): void {
  mutateCart(id, () => []);
}

export function readCart(cartOwnerId?: string): CartItem[] {
  try {
    const raw = localStorage.getItem(storageKey(cartOwnerId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('version' in parsed) ||
      parsed.version !== CART_VERSION
    )
      return [];
    return canonicalCart('items' in parsed ? parsed.items : undefined);
  } catch {
    return [];
  }
}

export function writeCart(cartOwnerId: string | undefined, items: CartItem[]): boolean {
  try {
    const stored: StoredCart = {
      version: CART_VERSION,
      items: canonicalCart(items).map(({ id, quantity }) => ({ id, quantity })),
    };
    localStorage.setItem(storageKey(cartOwnerId), JSON.stringify(stored));
    return true;
  } catch {
    // The in-memory cart remains usable when browser storage is unavailable or full.
    return false;
  }
}

export function updateCartItem(items: CartItem[], id: string, delta: number): CartItem[] {
  if (!Number.isInteger(delta) || delta === 0) return items;
  const item = MENU_ITEMS.find((entry) => entry.id === id);
  if (!item) return items;
  const existing = items.find((entry) => entry.id === id);
  const quantity = Math.max(0, Math.min(99, (existing?.quantity ?? 0) + delta));
  if (quantity === 0) return items.filter((entry) => entry.id !== id);
  return existing
    ? items.map((entry) => (entry.id === id ? { ...entry, quantity } : entry))
    : [...items, { ...item, quantity }];
}
