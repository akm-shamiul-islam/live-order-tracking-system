import { UserSummarySchema, type AuthResponse, type UserSummary } from '@kitchentodoor/shared';
import { createStore } from 'zustand/vanilla';

interface AuthSession {
  user: UserSummary | null;
  token: string | null;
}

const emptySession: AuthSession = { user: null, token: null };

function readStoredSession(): AuthSession | undefined {
  let token: string | null;
  let savedUser: string | null;
  try {
    token = localStorage.getItem('ktd_token');
    savedUser = localStorage.getItem('ktd_user');
  } catch {
    return undefined;
  }
  try {
    if (!token || !savedUser) return emptySession;
    const user = UserSummarySchema.parse(JSON.parse(savedUser));
    return { token, user };
  } catch {
    return emptySession;
  }
}

export const authStore = createStore<AuthSession>()(() => readStoredSession() ?? emptySession);

export function getSession(): AuthSession {
  return authStore.getState();
}

export function subscribeSession(listener: () => void) {
  return authStore.subscribe(listener);
}

export function saveSession(response: AuthResponse) {
  authStore.setState({ user: response.user, token: response.accessToken });
  try {
    localStorage.setItem('ktd_token', response.accessToken);
    localStorage.setItem('ktd_user', JSON.stringify(response.user));
  } catch {
    // The active session still works when browser storage is unavailable.
  }
}

export function clearSession() {
  authStore.setState(emptySession);
  try {
    localStorage.removeItem('ktd_token');
    localStorage.removeItem('ktd_user');
  } catch {
    // Storage may be blocked by the browser.
  }
}

function handleStorage(event: StorageEvent) {
  if (event.key === null || event.key === 'ktd_token' || event.key === 'ktd_user') {
    synchronizeStoredSession();
  }
}

function synchronizeStoredSession() {
  const stored = readStoredSession();
  if (stored) authStore.setState(stored);
}

export function listenForSessionChanges() {
  window.addEventListener('storage', handleStorage);
  // Recover events fired between module initialization and the React effect mounting.
  synchronizeStoredSession();
  return () => {
    window.removeEventListener('storage', handleStorage);
  };
}
