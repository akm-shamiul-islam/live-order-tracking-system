import { useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { useQueryClient } from '@tanstack/react-query';
import { authStore, getSession, saveSession, listenForSessionChanges } from '../../lib/authSession';
import { api } from '../../lib/api';
import { clientSettings } from '../../lib/clientSettings';
import { listenForLanguagePreferences } from '../../lib/languagePreferences';

export function AuthSessionSync() {
  const token = useStore(authStore, (state) => state.token);
  const identity = useStore(authStore, (state) =>
    state.user ? `${state.user.id}:${state.user.role}` : 'guest',
  );
  const previousIdentity = useRef(identity);
  const queryClient = useQueryClient();

  useEffect(listenForSessionChanges, []);
  useEffect(listenForLanguagePreferences, []);

  useEffect(() => {
    if (previousIdentity.current === identity) return;
    previousIdentity.current = identity;
    for (const key of [
      'admin-orders',
      'order',
      'my-orders',
      'couriers',
      'users',
      'available-deliveries',
      'profile',
      'profile-change',
      'profile-photo',
      'notifications',
    ]) {
      void queryClient.cancelQueries({ queryKey: [key] });
      queryClient.removeQueries({ queryKey: [key] });
    }
  }, [identity, queryClient]);

  useEffect(() => {
    if (!token) {
      for (const key of ['profile', 'profile-change', 'profile-photo', 'notifications']) {
        void queryClient.cancelQueries({ queryKey: [key] });
        queryClient.removeQueries({ queryKey: [key] });
      }
      queryClient.removeQueries({ queryKey: ['admin-orders'] });
      queryClient.removeQueries({ queryKey: ['auth-session'] });
      queryClient.removeQueries({ queryKey: ['order'] });
      queryClient.removeQueries({ queryKey: ['my-orders'] });
      queryClient.removeQueries({ queryKey: ['couriers'] });
      queryClient.removeQueries({ queryKey: ['users'] });
      queryClient.removeQueries({ queryKey: ['available-deliveries'] });
      return;
    }
    const verify = () => {
      void queryClient
        .query({
          queryKey: ['auth-session', token],
          queryFn: () => api.auth.getMe(),
          staleTime: clientSettings.VITE_SESSION_STALE_TIME_MS,
          retry: false,
        })
        .then((user) => {
          if (getSession().token === token) saveSession({ accessToken: token, user });
        })
        .catch(() => {
          // The API client clears an expired session when verification returns 401.
        });
    };
    verify();
    const onFocus = () => {
      if (document.visibilityState === 'visible') verify();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    const timer = window.setInterval(
      onFocus,
      Math.max(1000, clientSettings.VITE_SESSION_STALE_TIME_MS),
    );
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [token, queryClient]);

  return null;
}
