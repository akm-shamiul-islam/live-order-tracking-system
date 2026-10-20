import { useStore } from 'zustand';
import { UserRole } from '@kitchentodoor/shared';
import { api } from '../lib/api';
import { authStore } from '../lib/authSession';

export function useAuth() {
  const user = useStore(authStore, (state) => state.user);
  const token = useStore(authStore, (state) => state.token);

  const isAdmin = user?.role === UserRole.ADMIN;
  const isCourier = user?.role === UserRole.COURIER;

  return {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isAdmin,
    isCourier,
    login: (email: string, password: string) => api.auth.login(email, password),
    register: (name: string, email: string, password: string, phone: string) =>
      api.auth.register(name, email, password, phone),
    logout: () => api.auth.logout(),
  };
}
