import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthResponse, OrderDetails } from '@kitchentodoor/shared';

function orderResponse(id: string) {
  const order: OrderDetails = {
    id,
    orderNumber: 'KTD-1234',
    customer: { name: 'Test Customer', phone: '555-1234', address: '123 Test Street' },
    items: [{ itemId: 'item-1', name: 'Burger', price: 10, quantity: 1 }],
    pricing: { subtotal: 10, deliveryFee: 5, tax: 0.8, total: 15.8 },
    status: 'PLACED',
    deliveryCoordinates: { lat: 35, lng: 139 },
    deliveryLocationProvided: false,
    deliveryRequests: [],
    statusHistory: [],
    createdAt: '2026-10-23T00:00:00.000Z',
    updatedAt: '2026-10-23T00:00:00.000Z',
  };
  return { success: true, order };
}

describe('API requests and shared authentication', () => {
  const fetchMock = vi.fn<typeof fetch>();
  let api: typeof import('./api').api;
  let session: typeof import('./authSession');
  const response: AuthResponse = {
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
    const tabStorage = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => tabStorage.get(key) ?? null,
      setItem: (key: string, value: string) => tabStorage.set(key, value),
      removeItem: (key: string) => tabStorage.delete(key),
    });
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('fetch', fetchMock);
    ({ api } = await import('./api'));
    session = await import('./authSession');
  });

  afterEach(() => vi.unstubAllGlobals());

  it('sends the optional registration address and keeps it in the persisted profile', async () => {
    const address = '45 Registration Avenue, Apt 2\nTest City 10001';
    const registered = {
      accessToken: 'registered-token',
      user: {
        id: 'customer-1',
        name: 'New Customer',
        email: 'customer@example.test',
        phone: '555-1234',
        role: 'CUSTOMER',
        address,
      },
    };
    fetchMock.mockResolvedValueOnce(Response.json(registered));
    await api.auth.register(
      'New Customer',
      'customer@example.test',
      'Password123!',
      '555-1234',
      address,
    );
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/auth/register');
    const registrationBody = fetchMock.mock.calls[0]?.[1]?.body;
    if (typeof registrationBody !== 'string') throw new Error('Expected a JSON registration body');
    expect(JSON.parse(registrationBody)).toEqual({
      language: 'en',
      name: 'New Customer',
      email: 'customer@example.test',
      password: 'Password123!',
      phone: '555-1234',
      address,
    });
    expect(session.getSession().user?.address).toBe(address);
    expect(JSON.parse(localStorage.getItem('ktd_user')!).address).toBe(address);
  });

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
    session.saveSession(response);
    fetchMock.mockResolvedValueOnce(Response.json({ message: 'Unauthorized' }, { status: 401 }));
    fetchMock.mockResolvedValueOnce(Response.json({ message: 'Unauthorized' }, { status: 401 }));
    await expect(api.auth.getMe()).rejects.toMatchObject({ status: 401 });
    expect(session.getSession().token).toBeNull();
  });

  it('rotates expired credentials once and retries the original request', async () => {
    session.saveSession(response);
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
    session.saveSession(response);
    fetchMock.mockResolvedValueOnce(Response.json({}, { status: 401 }));
    fetchMock.mockResolvedValueOnce(Response.json({}, { status: 503 }));
    await expect(api.auth.getMe()).rejects.toMatchObject({ status: 503 });
    expect(session.getSession().token).toBe(response.accessToken);
  });

  it('cannot restore a session after sign-out while a refresh response is pending', async () => {
    session.saveSession(response);
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

  it('serializes sign-out after a pending login and prevents that response restoring the session', async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    fetchMock.mockResolvedValueOnce(Response.json({ success: true }));
    const login = api.auth.login('admin@example.com', 'password');
    const rejectedLogin = login.catch((error: unknown) => error);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const logout = api.auth.logout();
    expect(session.getSession().token).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    finish(Response.json(response));
    await expect(rejectedLogin).resolves.toMatchObject({ status: 409 });
    await expect(logout).resolves.toBe(true);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/auth/login',
      '/api/auth/logout',
    ]);
    expect(session.getSession().token).toBeNull();
  });

  it('preserves the newest sign-in when an earlier sign-in finishes late', async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const latest = { ...response, accessToken: 'newest-token' };
    fetchMock.mockResolvedValueOnce(Response.json(latest));
    const old = api.auth.login('admin@example.com', 'password');
    const rejectedOld = old.catch((error: unknown) => error);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const recent = api.auth.login('admin@example.com', 'different-password');
    finish(Response.json(response));
    await expect(rejectedOld).resolves.toMatchObject({ status: 409 });
    await expect(recent).resolves.toEqual(latest);
    expect(session.getSession().token).toBe('newest-token');
  });

  it('reports failed server revocation while clearing credentials on this device', async () => {
    session.saveSession(response);
    fetchMock.mockResolvedValueOnce(Response.json({}, { status: 503 }));
    await expect(api.auth.logout()).resolves.toBe(false);
    expect(session.getSession().token).toBeNull();
    const { logoutFeedbackStore } = await import('./authSession');
    expect(logoutFeedbackStore.getState()).toMatchObject({ failed: true, pending: false });
    fetchMock.mockResolvedValueOnce(Response.json({ success: true }));
    await expect(api.auth.logout()).resolves.toBe(true);
    expect(logoutFeedbackStore.getState()).toMatchObject({ failed: false, pending: false });
  });

  it('does not cancel a new login when a previous refresh is rejected', async () => {
    session.saveSession(response);
    let finish!: (response: Response) => void;
    fetchMock.mockResolvedValueOnce(Response.json({}, { status: 401 }));
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const verification = api.auth.getMe().catch((error: unknown) => error);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fetchMock.mockResolvedValueOnce(Response.json({ ...response, accessToken: 'new-login-token' }));
    const login = api.auth.login('admin@example.com', 'password');
    finish(Response.json({}, { status: 401 }));
    await expect(verification).resolves.toMatchObject({ status: 401 });
    await expect(login).resolves.toMatchObject({ accessToken: 'new-login-token' });
    expect(session.getSession().token).toBe('new-login-token');
  });

  it('clears a session saved by another tab while sign-out was waiting', async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const logout = api.auth.logout();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    session.saveSession(response);
    finish(Response.json({ success: true }));
    await expect(logout).resolves.toBe(true);
    expect(session.getSession().token).toBeNull();
    expect(localStorage.getItem('ktd_token')).toBeNull();
  });

  it('does not clear a newer session when an older request returns 401', async () => {
    session.saveSession(response);
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const request = api.auth.getMe();
    session.saveSession({ ...response, accessToken: 'new-token' });
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

  it('ignores malformed error entries while retaining valid inline messages', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        {
          message: { unexpected: true },
          errors: [
            null,
            'invalid entry',
            { message: 42 },
            { field: 'email', message: 'Check email' },
          ],
        },
        { status: 400 },
      ),
    );
    await expect(api.auth.login('invalid', 'password')).rejects.toMatchObject({
      status: 400,
      message: 'Check email',
      fieldErrors: { email: 'Check email' },
    });
  });

  it.each([null, { message: { unexpected: true } }, { errors: [null, 42] }])(
    'uses a readable fallback for an unrecognized error envelope',
    async (data) => {
      fetchMock.mockResolvedValueOnce(Response.json(data, { status: 400 }));
      await expect(api.auth.login('invalid', 'password')).rejects.toMatchObject({
        status: 400,
        message: 'The request could not be completed. Please try again.',
        fieldErrors: {},
      });
    },
  );

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
      profilePhotoMaxBytes: 2_000_000,
    });
  });

  it('reuses the checkout key after a lost response and reload, then starts a new successful checkout', async () => {
    session.saveSession(response);
    const dto = {
      customer: { name: 'Test Customer', phone: '555-1234', address: '123 Test Street' },
      deliveryAddress: '123 Test Street',
      items: [{ itemId: 'item-1', name: 'Burger', price: 10, quantity: 1 }],
    };
    fetchMock.mockRejectedValueOnce(new TypeError('Lost response after the database commit'));
    await expect(api.orders.create(dto)).rejects.toMatchObject({ status: 0 });
    const key = new Headers(fetchMock.mock.calls[0]![1]!.headers).get('Idempotency-Key');
    expect(key).toMatch(/^[a-f\d-]{36}$/i);
    expect(sessionStorage.getItem('ktd_checkout_attempt')).not.toMatch(
      /Test Customer|Test Street|555-1234/,
    );
    vi.resetModules();
    ({ api } = await import('./api'));
    fetchMock.mockResolvedValueOnce(Response.json(orderResponse('saved-order')));
    await expect(api.orders.create(dto)).resolves.toMatchObject({ order: { id: 'saved-order' } });
    expect(new Headers(fetchMock.mock.calls[1]![1]!.headers).get('Idempotency-Key')).toBe(key);
    expect(sessionStorage.getItem('ktd_checkout_attempt')).toBeNull();
    fetchMock.mockResolvedValueOnce(Response.json(orderResponse('new-order')));
    await api.orders.create(dto);
    expect(new Headers(fetchMock.mock.calls[2]![1]!.headers).get('Idempotency-Key')).not.toBe(key);
  });

  it.each(['different account', 'new session for the same account'] as const)(
    'discards a late checkout result after switching to a %s',
    async (replacement) => {
      session.saveSession(response);
      const dto = {
        customer: { name: 'Test Customer', phone: '555-1234', address: '123 Test Street' },
        deliveryAddress: '123 Test Street',
        items: [{ itemId: 'item-1', name: 'Burger', price: 10, quantity: 1 }],
      };
      let finish!: (response: Response) => void;
      fetchMock.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      const checkout = api.orders.create(dto).catch((error: unknown) => error);
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      const fresh = {
        ...response,
        accessToken: 'new-session-token',
        user: {
          ...response.user,
          id: replacement === 'different account' ? 'other-customer' : response.user.id,
        },
      };
      fetchMock.mockResolvedValueOnce(Response.json(fresh));
      await api.auth.login(fresh.user.email, 'password');
      finish(Response.json(orderResponse('previous-session-order')));
      await expect(checkout).resolves.toMatchObject({ status: 409 });
      expect(session.getSession()).toMatchObject({ token: fresh.accessToken, user: fresh.user });
    },
  );

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

  it.each(['read', 'write'] as const)(
    'keeps the same device identity through OTP when storage %s is blocked',
    async (blocked) => {
      vi.stubGlobal('localStorage', {
        getItem() {
          if (blocked === 'read') throw new Error('Storage blocked');
          return null;
        },
        setItem() {
          throw new Error('Storage blocked');
        },
        removeItem() {},
      });
      const challenge = {
        status: 'verification_required',
        purpose: 'new_device_login',
        challengeId: 'a'.repeat(43),
        email: response.user.email,
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        resendAvailableAt: new Date(Date.now() + 60_000).toISOString(),
      };
      fetchMock.mockResolvedValueOnce(Response.json(challenge));
      fetchMock.mockResolvedValueOnce(Response.json(response));
      await api.auth.login(response.user.email, 'password');
      await api.auth.verifyLogin(challenge.challengeId, '123456');
      const bodies = fetchMock.mock.calls.map(([, options]) => {
        if (typeof options?.body !== 'string') throw new Error('Expected a JSON body');
        const body: unknown = JSON.parse(options.body);
        if (
          !body ||
          typeof body !== 'object' ||
          !('deviceId' in body) ||
          typeof body.deviceId !== 'string'
        )
          throw new Error('Expected a device identity in the request');
        return { deviceId: body.deviceId };
      });
      expect(bodies[0]?.deviceId).toMatch(/^[a-f\d-]{36}$/i);
      expect(bodies[1]?.deviceId).toBe(bodies[0]?.deviceId);
      expect(session.getSession().token).toBe(response.accessToken);
    },
  );

  it('refreshes an in-memory session when browser storage remains readable but writes fail', async () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Storage quota exceeded');
    });
    session.saveSession(response);
    fetchMock.mockResolvedValueOnce(Response.json({}, { status: 401 }));
    fetchMock.mockResolvedValueOnce(Response.json({ ...response, accessToken: 'rotated-token' }));
    fetchMock.mockResolvedValueOnce(Response.json(response.user));
    await expect(api.auth.getMe()).resolves.toEqual(response.user);
    expect(session.getSession().token).toBe('rotated-token');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/auth/refresh');
  });

  it.each(['removed', 'replaced'] as const)(
    'keeps an OTP login bound to its original device when another tab has %s the stored ID',
    async (change) => {
      const original = '00000000-0000-4000-8000-000000000001';
      localStorage.setItem('kitchentodoor.device-id', original);
      const challenge = {
        status: 'verification_required',
        purpose: 'new_device_login',
        challengeId: 'a'.repeat(43),
        email: response.user.email,
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        resendAvailableAt: new Date(Date.now() + 60_000).toISOString(),
      };
      fetchMock.mockResolvedValueOnce(Response.json(challenge));
      fetchMock.mockResolvedValueOnce(Response.json(response));
      await api.auth.login(response.user.email, 'password');
      if (change === 'removed') localStorage.removeItem('kitchentodoor.device-id');
      else localStorage.setItem('kitchentodoor.device-id', '00000000-0000-4000-8000-000000000002');
      await api.auth.verifyLogin(challenge.challengeId, '123456');
      const body = fetchMock.mock.calls[1]?.[1]?.body;
      if (typeof body !== 'string') throw new Error('Expected a JSON verification body');
      const submitted: unknown = JSON.parse(body);
      expect(submitted).toMatchObject({ deviceId: original });
      expect(session.getSession().token).toBe(response.accessToken);
    },
  );

  it('preserves the checkout retry key when a successful HTTP response has no valid order', async () => {
    session.saveSession(response);
    const dto = {
      customer: { name: 'Test Customer', phone: '555-1234', address: '123 Test Street' },
      deliveryAddress: '123 Test Street',
      items: [{ itemId: 'item-1', name: 'Burger', price: 10, quantity: 1 }],
    };
    fetchMock.mockResolvedValueOnce(Response.json({ success: true, order: null }));
    await expect(api.orders.create(dto)).rejects.toMatchObject({ status: 502 });
    const key = new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('Idempotency-Key');
    if (!key) throw new Error('Expected a checkout retry key');
    expect(sessionStorage.getItem('ktd_checkout_attempt')).toContain(key);
    fetchMock.mockRejectedValueOnce(new TypeError('Temporary outage'));
    await expect(api.orders.create(dto)).rejects.toMatchObject({ status: 0 });
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get('Idempotency-Key')).toBe(key);
    fetchMock.mockResolvedValueOnce(Response.json(orderResponse('saved-order')));
    await expect(api.orders.create(dto)).resolves.toMatchObject({ order: { id: 'saved-order' } });
    expect(new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get('Idempotency-Key')).toBe(key);
    expect(sessionStorage.getItem('ktd_checkout_attempt')).toBeNull();
  });

  it.each([
    { name: 'current user', data: {}, run: () => api.auth.getMe() },
    {
      name: 'order details',
      data: { success: true, order: null },
      run: () => api.orders.getById('order'),
    },
    {
      name: 'dispatch pagination',
      data: { success: true, count: 0, orders: [] },
      run: () => api.orders.getPage({ page: 1, pageSize: 10 }),
    },
    {
      name: 'order history pagination',
      data: {
        success: true,
        count: 0,
        orders: [],
        pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
      },
      run: () => api.orders.getHistoryPage(undefined, 1, 10),
    },
    {
      name: 'delivery summaries',
      data: {
        orders: [{ id: 'order', status: 'INVALID' }],
        pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      },
      run: () => api.orders.available(1, 10),
    },
    { name: 'couriers', data: { couriers: [null] }, run: () => api.orders.getCouriers() },
    { name: 'user list', data: { users: [] }, run: () => api.users.list(1, 10) },
    { name: 'user history', data: {}, run: () => api.users.history('user') },
    { name: 'profile', data: {}, run: () => api.profile.get() },
    {
      name: 'notification count',
      data: {
        notifications: [],
        pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
        unreadCount: 'one',
      },
      run: () => api.notifications.list(),
    },
    {
      name: 'notification details',
      data: { notification: null },
      run: () => api.notifications.get('notification'),
    },
    {
      name: 'mutation acknowledgement',
      data: { success: false },
      run: () => api.orders.requestDelivery('order'),
    },
    { name: 'OTP request', data: {}, run: () => api.auth.forgotPassword('customer@example.test') },
    {
      name: 'reset grant',
      data: { resetToken: null },
      run: () => api.auth.verifyPasswordReset('challenge', '123456'),
    },
  ])(
    'rejects a malformed successful $name response with a readable error',
    async ({ data, run }) => {
      fetchMock.mockResolvedValueOnce(Response.json(data));
      await expect(run()).rejects.toMatchObject({
        status: 502,
        message: 'The service returned an unexpected response. Please try again.',
      });
    },
  );
});
