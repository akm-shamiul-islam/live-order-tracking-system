import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('API requests and shared authentication', () => {
  const fetchMock = vi.fn<typeof fetch>();
  let api: typeof import('./api').api;
  let session: typeof import('./authSession');
  const response = {
    accessToken: 'signed-token',
    user: { id: 'admin-1', name: 'Dispatcher', email: 'admin@example.com', role: 'ADMIN' },
  };

  beforeEach(async () => {
    vi.resetModules();
    fetchMock.mockReset();
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('fetch', fetchMock);
    ({ api } = await import('./api'));
    session = await import('./authSession');
  });

  afterEach(() => vi.unstubAllGlobals());

  it('notifies all authentication subscribers on login and logout', async () => {
    const first = vi.fn<() => void>();
    const second = vi.fn<() => void>();
    const unsubscribe = [session.subscribeSession(first), session.subscribeSession(second)];
    fetchMock.mockResolvedValueOnce(Response.json(response));
    await api.auth.login('admin@example.com', 'password');
    expect(session.getSession().user?.name).toBe('Dispatcher');
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    void api.auth.logout();
    expect(session.getSession()).toEqual({ user: null, token: null });
    expect(localStorage.getItem('ktd_token')).toBeNull();
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(2);
    for (const stop of unsubscribe) stop();
  });

  it('clears an expired session when both access and refresh credentials are rejected', async () => {
    session.saveSession(response as Parameters<typeof session.saveSession>[0]);
    fetchMock.mockResolvedValueOnce(Response.json({ message: 'Unauthorized' }, { status: 401 }));
    fetchMock.mockResolvedValueOnce(Response.json({ message: 'Unauthorized' }, { status: 401 }));
    await expect(api.auth.getMe()).rejects.toMatchObject({ status: 401 });
    expect(session.getSession().token).toBeNull();
  });

  it('rotates expired credentials once and retries the original request', async () => {
    session.saveSession(response as Parameters<typeof session.saveSession>[0]);
    const refreshed = { ...response, accessToken: 'refreshed-token' };
    fetchMock.mockResolvedValueOnce(Response.json({}, { status: 401 }));
    fetchMock.mockResolvedValueOnce(Response.json(refreshed));
    fetchMock.mockResolvedValueOnce(Response.json(response.user));
    await expect(api.auth.getMe()).resolves.toEqual(response.user);
    expect(session.getSession().token).toBe('refreshed-token');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/auth/refresh');
    expect(new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get('Authorization')).toBe(
      'Bearer refreshed-token',
    );
  });

  it('preserves a saved session during a refresh service outage', async () => {
    session.saveSession(response as Parameters<typeof session.saveSession>[0]);
    fetchMock.mockResolvedValueOnce(Response.json({}, { status: 401 }));
    fetchMock.mockResolvedValueOnce(Response.json({}, { status: 503 }));
    await expect(api.auth.getMe()).rejects.toMatchObject({ status: 503 });
    expect(session.getSession().token).toBe(response.accessToken);
  });

  it('cannot restore a session after sign-out while a refresh response is pending', async () => {
    session.saveSession(response as Parameters<typeof session.saveSession>[0]);
    let finish!: (response: Response) => void;
    fetchMock.mockResolvedValueOnce(Response.json({}, { status: 401 }));
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = api.auth.getMe();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    session.clearSession();
    finish(Response.json({ ...response, accessToken: 'late-token' }));
    await expect(pending).rejects.toMatchObject({ status: 401 });
    expect(session.getSession().token).toBeNull();
  });

  it('does not clear a newer session when an older request returns 401', async () => {
    session.saveSession(response as Parameters<typeof session.saveSession>[0]);
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const request = api.auth.getMe();
    session.saveSession({ ...response, accessToken: 'new-token' } as Parameters<
      typeof session.saveSession
    >[0]);
    finish(Response.json({ message: 'Unauthorized' }, { status: 401 }));
    await expect(request).rejects.toMatchObject({ status: 401 });
    expect(session.getSession().token).toBe('new-token');
  });

  it('uses a readable message when the service cannot be reached', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(api.auth.login('admin@example.com', 'password')).rejects.toThrow(
      'Check your connection',
    );
  });

  it('rejects an HTML fallback instead of accepting it as a successful login', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>Missing proxy</html>'));
    await expect(api.auth.login('admin@example.com', 'password')).rejects.toThrow(
      'unexpected response',
    );
    expect(session.getSession().token).toBeNull();
  });

  it.each([{ accessToken: '', user: response.user }, { unrelated: true }])(
    'rejects malformed authentication JSON without saving a session',
    async (data) => {
      fetchMock.mockResolvedValueOnce(Response.json(data));
      await expect(api.auth.login('admin@example.com', 'password')).rejects.toMatchObject({
        status: 502,
        message: expect.stringContaining('unexpected response'),
      });
      expect(session.getSession()).toEqual({ user: null, token: null });
    },
  );

  it('displays field-level server validation messages', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        {
          message: 'Validation failed',
          errors: [{ field: 'email', message: 'Enter a valid email address' }],
        },
        { status: 400 },
      ),
    );
    await expect(api.auth.login('invalid', 'password')).rejects.toMatchObject({
      message: 'Enter a valid email address',
      status: 400,
      fieldErrors: { email: 'Enter a valid email address' },
    });
  });

  it('uses the server Retry-After window instead of a fixed wait message', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { message: 'Too Many Requests' },
        { status: 429, headers: { 'Retry-After': '180' } },
      ),
    );
    await expect(api.auth.login('admin@example.com', 'password')).rejects.toMatchObject({
      status: 429,
      message: expect.stringContaining('180 seconds'),
    });
  });

  it('loads server-configured public pricing', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ pricing: { deliveryFee: 7.25, taxRate: 0.12 } }),
    );
    await expect(api.settings.get()).resolves.toEqual({
      pricing: { deliveryFee: 7.25, taxRate: 0.12 },
    });
  });

  it('keeps the session usable when browser storage is blocked', async () => {
    vi.stubGlobal('localStorage', {
      setItem() {
        throw new Error('Storage blocked');
      },
      removeItem() {
        throw new Error('Storage blocked');
      },
    });
    fetchMock.mockResolvedValueOnce(Response.json(response));
    await api.auth.login('admin@example.com', 'password');
    expect(session.getSession().token).toBe('signed-token');
    void api.auth.logout();
    expect(session.getSession().token).toBeNull();
  });
});
