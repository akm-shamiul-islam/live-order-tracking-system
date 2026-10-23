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

  it('keeps an approved profile when an older verification response arrives later', async () => {
    const { getSession, saveSession } = await import('./authSession');
    saveSession({
      accessToken: 'token',
      user: {
        ...user,
        name: 'Approved Name',
        address: 'New Address',
        photoId: 'approved-photo',
        profileVersion: 2,
      },
    });
    saveSession({
      accessToken: 'token',
      user: { ...user, name: 'Old Name', address: 'Old Address', profileVersion: 1 },
    });
    expect(getSession().user).toMatchObject({
      name: 'Approved Name',
      address: 'New Address',
      photoId: 'approved-photo',
      profileVersion: 2,
    });
  });

  it('avoids publishing identical profile checks while preserving role and token changes', async () => {
    const { getSession, saveSession, subscribeSession, synchronizeStoredSession } =
      await import('./authSession');
    saveSession({ user, accessToken: 'current-token' });
    const saved = getSession();
    const listener = vi.fn<() => void>();
    const stop = subscribeSession(listener);
    synchronizeStoredSession();
    saveSession({ user: { ...user }, accessToken: 'current-token' });
    expect(getSession()).toBe(saved);
    expect(listener).not.toHaveBeenCalled();
    saveSession({ user: { ...user, role: 'COURIER' }, accessToken: 'current-token' });
    expect(getSession().user?.role).toBe('COURIER');
    expect(listener).toHaveBeenCalledTimes(1);
    saveSession({ user, accessToken: 'rotated-token' });
    expect(getSession().token).toBe('rotated-token');
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
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

  it('restores saved delivery addresses and publishes address-only profile changes across tabs', async () => {
    const original = { ...user, address: '123 Saved Address' };
    localStorage.setItem('ktd_token', 'saved-token');
    localStorage.setItem('ktd_user', JSON.stringify(original));
    const { getSession, saveSession, subscribeSession, listenForSessionChanges } =
      await import('./authSession');
    expect(getSession().user?.address).toBe(original.address);
    const listener = vi.fn<() => void>();
    const stopSubscription = subscribeSession(listener);
    const stopStorage = listenForSessionChanges();
    const updated = { ...original, address: '456 Updated Address' };
    saveSession({ user: updated, accessToken: 'saved-token' });
    expect(getSession().user?.address).toBe(updated.address);
    expect(listener).toHaveBeenCalledTimes(1);
    saveSession({ user: { ...updated }, accessToken: 'saved-token' });
    expect(listener).toHaveBeenCalledTimes(1);
    localStorage.setItem('ktd_user', JSON.stringify({ ...updated, address: '789 Other Tab' }));
    storageEvent('ktd_user');
    expect(getSession().user?.address).toBe('789 Other Tab');
    expect(listener).toHaveBeenCalledTimes(2);
    stopStorage();
    stopSubscription();
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

  it('keeps an in-memory login when storage is readable but cannot save it', async () => {
    const { getSession, saveSession, synchronizeStoredSession } = await import('./authSession');
    const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Storage quota exceeded');
    });
    saveSession({ user, accessToken: 'memory-token' });
    synchronizeStoredSession();
    expect(getSession()).toEqual({ user, token: 'memory-token' });
    write.mockRestore();
    saveSession({ user, accessToken: 'persisted-token' });
    expect(localStorage.getItem('ktd_token')).toBe('persisted-token');
    synchronizeStoredSession();
    expect(getSession().token).toBe('persisted-token');
  });

  it('does not restore old credentials when storage removal fails during logout', async () => {
    const { getSession, saveSession, clearSession, synchronizeStoredSession } =
      await import('./authSession');
    saveSession({ user, accessToken: 'previous-token' });
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('Storage is read-only');
    });
    clearSession();
    synchronizeStoredSession();
    expect(getSession()).toEqual({ user: null, token: null });
  });

  it('honors another tab signing out after a local persistence failure', async () => {
    const { getSession, saveSession, listenForSessionChanges } = await import('./authSession');
    const stop = listenForSessionChanges();
    saveSession({ user, accessToken: 'previous-token' });
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Storage quota exceeded');
    });
    saveSession({ user, accessToken: 'memory-token' });
    localStorage.clear();
    storageEvent(null);
    expect(getSession()).toEqual({ user: null, token: null });
    stop();
  });
});
