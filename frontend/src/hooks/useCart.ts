import { useEffect } from 'react';
import { useStore } from 'zustand';
import type { MenuItem } from '@kitchentodoor/shared';
import {
  addCartItem,
  cartStore,
  changeCartQuantity,
  clearCart,
  removeCartItem,
  synchronizeCart,
  synchronizeCartStorage,
  type CartItem,
} from '../lib/cart';

const emptyCart: CartItem[] = [];

export function useCart(ownerId?: string) {
  const owner = ownerId && /^[a-f\d]{24}$/i.test(ownerId) ? ownerId.toLowerCase() : 'guest';
  const items = useStore(cartStore, (state) => (state.owner === owner ? state.items : emptyCart));

  useEffect(() => {
    synchronizeCart(ownerId);
    const onStorage = (event: StorageEvent) => synchronizeCartStorage(event, ownerId);
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [owner, ownerId]);

  return {
    items,
    add: (item: MenuItem) => {
      addCartItem(ownerId, item);
    },
    updateQuantity: (id: string, delta: number) => {
      changeCartQuantity(ownerId, id, delta);
    },
    remove: (id: string) => {
      removeCartItem(ownerId, id);
    },
    clear: () => {
      clearCart(ownerId);
    },
    quantity: (id: string) => {
      return items.find((item) => item.id === id)?.quantity ?? 0;
    },
  };
}
