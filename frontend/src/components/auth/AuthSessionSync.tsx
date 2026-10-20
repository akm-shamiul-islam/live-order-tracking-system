import { useEffect } from 'react';
import { useStore } from 'zustand';
import { useQueryClient } from '@tanstack/react-query';
import { authStore, listenForSessionChanges } from '../../lib/authSession';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { clientSettings } from '../../lib/clientSettings';

export function AuthSessionSync() {
  const token = useStore(authStore, (state) => state.token);
  const queryClient = useQueryClient();

  useEffect(listenForSessionChanges, []);

  useEffect(() => {
    getSocket(token);
    if (!token) {
      queryClient.removeQueries({ queryKey: ['admin-orders'] });
      queryClient.removeQueries({ queryKey: ['auth-session'] });
      return;
    }
    void queryClient
      .query({
        queryKey: ['auth-session', token],
        queryFn: () => api.auth.getMe(),
        staleTime: clientSettings.VITE_SESSION_STALE_TIME_MS,
        retry: false,
      })
      .catch(() => {
        // The API client clears an expired session when verification returns 401.
      });
  }, [token, queryClient]);

  return null;
}
