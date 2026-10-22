import { createContext, use } from 'react';
import type { MenuItem } from '@kitchentodoor/shared';

interface AppActions {
  addToCart: (item: MenuItem) => void;
  updateCartQuantity: (id: string, delta: number) => void;
  getCartQuantity: (id: string) => number;
  openStaffLogin: () => void;
  openProfile: () => void;
  registerLeaveGuard: (guard: () => Promise<boolean>) => () => void;
}

export const AppActionsContext = createContext<AppActions | null>(null);

export function useAppActions() {
  const actions = use(AppActionsContext);
  if (!actions) throw new Error('App actions must be used inside the application layout.');
  return actions;
}
