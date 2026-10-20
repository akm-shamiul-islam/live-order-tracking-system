import { createContext, use } from 'react';
import type { MenuItem } from '../customer/MenuCatalog';

interface AppActions {
  addToCart: (item: MenuItem) => void;
  openStaffLogin: () => void;
}

export const AppActionsContext = createContext<AppActions | null>(null);

export function useAppActions() {
  const actions = use(AppActionsContext);
  if (!actions) throw new Error('App actions must be used inside the application layout.');
  return actions;
}
