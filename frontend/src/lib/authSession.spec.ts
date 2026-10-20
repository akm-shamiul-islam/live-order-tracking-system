import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const user = {
  id: 'admin-1',
  name: 'Dispatcher',
  email: 'admin@example.com',
  role: 'ADMIN' as const,
};

function storageEvent(key: string | null) {
  const event = new Event('storage');
  Object.defineProperty(event, 'key', { value: key });
  window.dispatchEvent(event);
}

describe('Zustand authentication persistence and tab synchronization', () => {
  beforeEach(() => {
    vi.resetModules();
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    });
    vi.stubGlobal('window', new EventTarget());
  });

  afterEach(() => vi.unstubAllGlobals());

  it('restores existing sessions without requiring users to log in again after the migration', async () => {
    localStorage.setItem('ktd_token', 'saved-token');
    localStorage.setItem('ktd_user', JSON.stringify(user));
    const { authStore, getSession } = await import('./authSession');
    expect(authStore.getState()).toEqual({ user, token: 'saved-token' });
    expect(getSession()).toBe(authStore.getState());
    expect(getSession()).toBe(getSession());
  });

  it('discards a corrupted saved user', async () => {
    localStorage.setItem('ktd_token', 'saved-token');
    localStorage.setItem('ktd_user', '{invalid json');
    const { getSession } = await import('./authSession');
    expect(getSession()).toEqual({ user: null, token: null });
  });

  it('propagates login and logout from another browser tab', async () => {
    const { authStore, listenForSessionChanges } = await import('./authSession');
    const stop = listenForSessionChanges();
    localStorage.setItem('ktd_token', 'other-tab-token');
    localStorage.setItem('ktd_user', JSON.stringify(user));
    storageEvent('ktd_token');
    expect(authStore.getState()).toEqual({ user, token: 'other-tab-token' });
    localStorage.clear();
    storageEvent(null);
    expect(authStore.getState()).toEqual({ user: null, token: null });
    stop();
  });

  it('ignores unrelated storage changes and releases the storage listener', async () => {
    const { getSession, saveSession, listenForSessionChanges } = await import('./authSession');
    saveSession({ user, accessToken: 'current-token' });
    const stop = listenForSessionChanges();
    localStorage.clear();
    storageEvent('ktd_theme');
    expect(getSession().token).toBe('current-token');
    stop();
    storageEvent('ktd_token');
    expect(getSession().token).toBe('current-token');
  });

  it('starts safely when browser storage cannot be read', async () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('Storage blocked');
      },
    });
    const { getSession } = await import('./authSession');
    expect(getSession()).toEqual({ user: null, token: null });
  });

  it('reconciles a logout that happens before the tab mounts its storage listener', async () => {
    localStorage.setItem('ktd_token', 'saved-token');
    localStorage.setItem('ktd_user', JSON.stringify(user));
    const { getSession, listenForSessionChanges } = await import('./authSession');
    expect(getSession().token).toBe('saved-token');
    localStorage.clear();
    const stop = listenForSessionChanges();
    expect(getSession()).toEqual({ user: null, token: null });
    stop();
  });

  it('keeps an in-memory login when synchronization cannot access storage', async () => {
    const { getSession, saveSession, listenForSessionChanges } = await import('./authSession');
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('Storage blocked');
      },
      setItem() {
        throw new Error('Storage blocked');
      },
    });
    saveSession({ user, accessToken: 'memory-token' });
    const stop = listenForSessionChanges();
    expect(getSession()).toEqual({ user, token: 'memory-token' });
    stop();
  });
});
