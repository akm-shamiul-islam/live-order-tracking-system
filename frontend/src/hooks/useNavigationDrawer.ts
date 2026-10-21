import { useEffect, useState } from 'react';

export const NAVIGATION_STORAGE_KEY = 'kitchentodoor.navigation.open';

export function useNavigationDrawer() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(NAVIGATION_STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(NAVIGATION_STORAGE_KEY, String(open));
    } catch {
      // Navigation remains usable when the browser disallows persistent storage.
    }
  }, [open]);
  return [open, setOpen] as const;
}
