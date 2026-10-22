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
export const authProgressStore = createStore<{
  action: 'login' | 'register' | 'logout' | null;
  intent: number;
}>()(() => ({ action: null, intent: 0 }));
export const logoutFeedbackStore = createStore<{ failed: boolean; pending: boolean }>()(() => ({
  failed: false,
  pending: false,
}));

export function getSession(): AuthSession {
  return authStore.getState();
}

export function subscribeSession(listener: () => void) {
  return authStore.subscribe(listener);
}

function updateSession(next: AuthSession) {
  const current = getSession();
  if (
    current.user &&
    next.user &&
    current.user.id === next.user.id &&
    (current.user.profileVersion ?? 0) > (next.user.profileVersion ?? 0)
  )
    next = {
      ...next,
      user: {
        ...next.user,
        name: current.user.name,
        email: current.user.email,
        phone: current.user.phone,
        address: current.user.address,
        photoId: current.user.photoId,
        role: current.user.role,
        profileVersion: current.user.profileVersion,
      },
    };
  if (
    current.user &&
    next.user &&
    current.user.id === next.user.id &&
    (current.user.languageVersion ?? 0) > (next.user.languageVersion ?? 0)
  ) {
    next = {
      ...next,
      user: {
        ...next.user,
        language: current.user.language,
        languageVersion: current.user.languageVersion,
      },
    };
  }
  const sameUser =
    current.user === next.user ||
    Boolean(
      current.user &&
      next.user &&
      current.user.id === next.user.id &&
      current.user.name === next.user.name &&
      current.user.email === next.user.email &&
      current.user.phone === next.user.phone &&
      current.user.address === next.user.address &&
      current.user.photoId === next.user.photoId &&
      current.user.profileVersion === next.user.profileVersion &&
      current.user.language === next.user.language &&
      current.user.languageVersion === next.user.languageVersion &&
      current.user.role === next.user.role,
    );
  if (sameUser && current.token === next.token) return;
  authStore.setState({ ...next, user: sameUser ? current.user : next.user });
}

export function saveSession(response: AuthResponse) {
  updateSession({ user: response.user, token: response.accessToken });
  const stored = getSession();
  try {
    if (stored.token) localStorage.setItem('ktd_token', stored.token);
    localStorage.setItem('ktd_user', JSON.stringify(stored.user));
  } catch {
    // The active session still works when browser storage is unavailable.
  }
}

export function clearSession() {
  updateSession(emptySession);
  try {
    localStorage.removeItem('ktd_token');
    localStorage.removeItem('ktd_user');
    localStorage.removeItem('ktd_last_phone');
  } catch {
    // Storage may be blocked by the browser.
  }
}

function handleStorage(event: StorageEvent) {
  if (event.key === null || event.key === 'ktd_token' || event.key === 'ktd_user') {
    synchronizeStoredSession();
  }
}

export function synchronizeStoredSession() {
  const stored = readStoredSession();
  if (stored) updateSession(stored);
}

export function listenForSessionChanges() {
  window.addEventListener('storage', handleStorage);
  // Recover events fired between module initialization and the React effect mounting.
  synchronizeStoredSession();
  return () => {
    window.removeEventListener('storage', handleStorage);
  };
}
