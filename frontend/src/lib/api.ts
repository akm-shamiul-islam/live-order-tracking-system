import {
  AuthResponse,
  CreateOrderDto,
  OrderDetails,
  OrderStatus,
  UserSummary,
  AuthResponseSchema,
  PublicConfigSchema,
  type PublicConfig,
  type AvailableDelivery,
  type PaginationInfo,
  type UserPage,
  type ManagedUser,
  type UpdateUserDto,
  type UserRole,
  type Language,
  LanguagePreferenceResponseSchema,
  type LanguagePreference,
} from '@kitchentodoor/shared';
import {
  clearSession,
  getSession,
  saveSession,
  synchronizeStoredSession,
  logoutFeedbackStore,
} from './authSession';
import { clientSettings } from './clientSettings';
import { getCheckoutAttempt, completeCheckoutAttempt } from './checkoutAttempt';
import { getDesiredLanguage } from './i18n';

const API_BASE = '/api';
let refreshInFlight: Promise<AuthResponse | null> | undefined;
let authIntent = 0;
let authQueue = Promise.resolve();

function withSessionLock<T>(run: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    // Login, logout, reset and rotation all set the same HttpOnly cookie. Serialize them
    // across tabs as well as within this tab so a late response cannot replace that cookie.
    return navigator.locks.request('ktd-auth-session', run);
  }
  const result = authQueue.then(run, run);
  authQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function authenticate(
  path: 'login' | 'register',
  body: Record<string, string>,
): Promise<AuthResponse> {
  const intent = ++authIntent;
  const before = getSession();
  return withSessionLock(async () => {
    synchronizeStoredSession();
    const isCurrent = () =>
      intent === authIntent &&
      getSession().token === before.token &&
      getSession().user?.id === before.user?.id;
    if (!isCurrent()) throw new ApiError('This sign-in was cancelled. Please try again.', 409);
    const res = await request(`${API_BASE}/auth/${path}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const auth = parseAuthResponse(await handleResponse<unknown>(res));
    if (!isCurrent()) throw new ApiError('This sign-in was cancelled. Please try again.', 409);
    saveSession(auth);
    logoutFeedbackStore.setState({ failed: false });
    return auth;
  });
}

async function refreshSession(failedToken: string): Promise<AuthResponse | null> {
  if (refreshInFlight) return refreshInFlight;
  const intent = authIntent;
  const rotate = async () => {
    if (intent !== authIntent) return null;
    synchronizeStoredSession();
    const before = getSession();
    if (before.token !== failedToken) {
      return before.token && before.user ? { accessToken: before.token, user: before.user } : null;
    }
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'same-origin',
        signal: AbortSignal.timeout(clientSettings.VITE_REQUEST_TIMEOUT_MS),
      });
      if (response.status === 401) {
        if (intent === authIntent && getSession().token === before.token) clearSession();
        return null;
      }
      const auth = parseAuthResponse(await handleResponse<unknown>(response));
      if (intent !== authIntent || getSession().token !== before.token) return null;
      saveSession(auth);
      return auth;
    } catch (error) {
      // A temporary outage must not turn a saved session into a sign-out.
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'We could not renew your session. Check your connection and try again.',
        0,
      );
    }
  };
  const run = withSessionLock(rotate);
  refreshInFlight = run.finally(() => {
    refreshInFlight = undefined;
  });
  return refreshInFlight;
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getSession().token;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

function parseAuthResponse(data: unknown): AuthResponse {
  const parsed = AuthResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError('The service returned an unexpected response. Please try again.', 502);
  }
  return parsed.data;
}

function retryAfterMessage(response: Response): string {
  const header = response.headers.get('Retry-After');
  if (!header) return 'Too many attempts. Please try again later.';
  const seconds = /^\d+$/.test(header)
    ? Number(header)
    : Math.ceil((Date.parse(header) - Date.now()) / 1000);
  return Number.isFinite(seconds) && seconds > 0
    ? `Too many attempts. Please wait ${seconds} seconds before trying again.`
    : 'Too many attempts. Please try again shortly.';
}

async function request(url: string, options: RequestInit = {}): Promise<Response> {
  try {
    // Fastify rejects an application/json POST with no body. Only label actual JSON bodies.
    const requestHeaders = new Headers(options.headers);
    if (typeof options.body === 'string' && !requestHeaders.has('Content-Type'))
      requestHeaders.set('Content-Type', 'application/json');
    let response = await fetch(url, {
      ...options,
      headers: requestHeaders,
      credentials: 'same-origin',
      signal: options.signal
        ? AbortSignal.any([
            options.signal,
            AbortSignal.timeout(clientSettings.VITE_REQUEST_TIMEOUT_MS),
          ])
        : AbortSignal.timeout(clientSettings.VITE_REQUEST_TIMEOUT_MS),
    });
    const authorization = requestHeaders.get('Authorization');
    if (
      response.status === 401 &&
      authorization === `Bearer ${getSession().token}` &&
      !url.endsWith('/auth/logout')
    ) {
      const failedToken = authorization.replace(/^Bearer\s+/i, '');
      const refreshed = await refreshSession(failedToken);
      if (refreshed && getSession().token === refreshed.accessToken) {
        const headers = new Headers(requestHeaders);
        headers.set('Authorization', `Bearer ${refreshed.accessToken}`);
        response = await fetch(url, {
          ...options,
          headers,
          credentials: 'same-origin',
          signal: options.signal
            ? AbortSignal.any([
                options.signal,
                AbortSignal.timeout(clientSettings.VITE_REQUEST_TIMEOUT_MS),
              ])
            : AbortSignal.timeout(clientSettings.VITE_REQUEST_TIMEOUT_MS),
        });
        if (response.status === 401 && getSession().token === refreshed.accessToken) clearSession();
      }
    }
    return response;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('We could not reach the service. Check your connection and try again.', 0);
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const details = Array.isArray(data?.errors)
      ? data.errors
          .map((error: { message?: string }) => error.message)
          .filter(Boolean)
          .join(' ')
      : undefined;
    const errorMsg =
      res.status >= 500
        ? 'The service is temporarily unavailable. Please try again shortly.'
        : res.status === 429
          ? retryAfterMessage(res)
          : details ||
            (Array.isArray(data?.message) ? data.message.join(' ') : data?.message) ||
            (res.status === 401
              ? 'Your session has expired. Please sign in again.'
              : 'The request could not be completed. Please try again.');
    const fieldErrors: Record<string, string> = {};
    if (Array.isArray(data?.errors)) {
      for (const issue of data.errors) {
        if (
          typeof issue?.field === 'string' &&
          typeof issue?.message === 'string' &&
          !fieldErrors[issue.field]
        ) {
          fieldErrors[issue.field] = issue.message;
        }
      }
    }
    throw new ApiError(errorMsg, res.status, fieldErrors);
  }
  if (!data || typeof data !== 'object') {
    throw new ApiError('The service returned an unexpected response. Please try again.', 502);
  }
  return data as T;
}

export const api = {
  settings: {
    async get(): Promise<PublicConfig> {
      const response = await request(`${API_BASE}/config`);
      const parsed = PublicConfigSchema.safeParse(await handleResponse<unknown>(response));
      if (!parsed.success)
        throw new ApiError('Delivery pricing could not be loaded. Please try again.', 502);
      return parsed.data;
    },
  },
  auth: {
    async forgotPassword(email: string): Promise<void> {
      await handleResponse(
        await request(`${API_BASE}/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        }),
      );
    },

    async resetPassword(token: string, password: string, confirmPassword: string): Promise<void> {
      ++authIntent;
      await withSessionLock(async () => {
        await handleResponse(
          await request(`${API_BASE}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, password, confirmPassword }),
          }),
        );
        clearSession();
      });
    },
    login(email: string, pass: string): Promise<AuthResponse> {
      return authenticate('login', { email, password: pass });
    },

    async register(
      name: string,
      email: string,
      pass: string,
      phone: string,
      address?: string,
    ): Promise<AuthResponse> {
      return authenticate('register', {
        name,
        email,
        password: pass,
        phone,
        ...(address ? { address } : {}),
        language: getDesiredLanguage(),
      });
    },

    async getMe(): Promise<UserSummary> {
      const res = await request(`${API_BASE}/auth/me`, {
        headers: getHeaders(),
      });
      return handleResponse<UserSummary>(res);
    },

    async updateLanguage(this: void, language: Language): Promise<LanguagePreference> {
      const intent = authIntent;
      const owner = getSession().user?.id;
      if (!owner) throw new ApiError('Please sign in again.', 401);
      const res = await request(`${API_BASE}/auth/preferences`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ language }),
      });
      const preference = LanguagePreferenceResponseSchema.parse(await handleResponse<unknown>(res));
      if (intent !== authIntent || getSession().user?.id !== owner)
        throw new ApiError('Your account changed. Sign in and try again.', 409);
      return preference;
    },

    logout() {
      const headers = getHeaders();
      ++authIntent;
      clearSession();
      logoutFeedbackStore.setState({ failed: false, pending: true });
      return withSessionLock(async () => {
        try {
          await handleResponse(
            await request(`${API_BASE}/auth/logout`, { method: 'POST', headers, keepalive: true }),
          );
          logoutFeedbackStore.setState({ failed: false });
          return true;
        } catch {
          logoutFeedbackStore.setState({ failed: true });
          return false;
        } finally {
          // A different tab may have completed an older sign-in while this logout waited
          // for the shared lock. Clear that saved state after revocation as well.
          clearSession();
          logoutFeedbackStore.setState({ pending: false });
        }
      });
    },
  },

  orders: {
    async available(
      page: number,
      pageSize: number,
    ): Promise<{ orders: AvailableDelivery[]; pagination: PaginationInfo }> {
      return handleResponse(
        await request(
          `${API_BASE}/orders/available?${new URLSearchParams({ page: String(page), limit: String(pageSize) })}`,
          { headers: getHeaders() },
        ),
      );
    },
    async requestDelivery(orderId: string): Promise<void> {
      await handleResponse(
        await request(`${API_BASE}/orders/${encodeURIComponent(orderId)}/delivery-requests`, {
          method: 'POST',
          headers: getHeaders(),
        }),
      );
    },
    async reviewDelivery(
      orderId: string,
      courierId: string,
      decision: 'APPROVE' | 'REJECT',
    ): Promise<void> {
      await handleResponse(
        await request(
          `${API_BASE}/orders/${encodeURIComponent(orderId)}/delivery-requests/${encodeURIComponent(courierId)}`,
          { method: 'POST', headers: getHeaders(), body: JSON.stringify({ decision }) },
        ),
      );
    },
    async getCouriers(): Promise<UserSummary[]> {
      const data = await handleResponse<{ couriers: UserSummary[] }>(
        await request(`${API_BASE}/orders/couriers`, { headers: getHeaders() }),
      );
      return data.couriers;
    },

    async assignCourier(orderId: string, courierId?: string | null): Promise<OrderDetails> {
      const data = await handleResponse<{ order: OrderDetails }>(
        await request(`${API_BASE}/orders/${encodeURIComponent(orderId)}/courier`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ courierId }),
        }),
      );
      return data.order;
    },
    async create(dto: CreateOrderDto): Promise<{ success: boolean; order: OrderDetails }> {
      const ownerId = getSession().user?.id;
      if (!ownerId) throw new ApiError('Sign in before placing an order.', 401);
      const attempt = await getCheckoutAttempt(ownerId, dto);
      if (getSession().user?.id !== ownerId)
        throw new ApiError('Your account changed. Sign in and try again.', 401);
      const res = await request(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { ...getHeaders(), 'Idempotency-Key': attempt.key },
        body: JSON.stringify(dto),
      });
      const result = await handleResponse<{ success: boolean; order: OrderDetails }>(res);
      completeCheckoutAttempt(attempt.key);
      return result;
    },

    async getById(orderId: string, signal?: AbortSignal): Promise<OrderDetails> {
      const res = await request(`${API_BASE}/orders/${encodeURIComponent(orderId)}`, {
        headers: getHeaders(),
        signal,
      });
      const data = await handleResponse<{ success: boolean; order: OrderDetails }>(res);
      return data.order;
    },

    async getPage({
      status,
      search,
      page,
      pageSize,
    }: {
      status?: string;
      search?: string;
      page: number;
      pageSize: number;
    }): Promise<import('@kitchentodoor/shared').OrderPage> {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (status) params.set('status', status);
      if (search) params.set('search', search);
      const res = await request(`${API_BASE}/orders?${params}`, { headers: getHeaders() });
      return handleResponse<import('@kitchentodoor/shared').OrderPage>(res);
    },

    async getHistoryPage(
      phone: string | undefined,
      page: number,
      pageSize: number,
      q = '',
    ): Promise<import('@kitchentodoor/shared').OrderPage> {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (phone) params.set('phone', phone);
      if (q) params.set('q', q);
      const res = await request(`${API_BASE}/orders/my-orders?${params}`, {
        headers: getHeaders(),
      });
      return handleResponse<import('@kitchentodoor/shared').OrderPage>(res);
    },

    async getAll(status?: string): Promise<OrderDetails[]> {
      const url = status
        ? `${API_BASE}/orders?status=${encodeURIComponent(status)}`
        : `${API_BASE}/orders`;
      const res = await request(url, {
        headers: getHeaders(),
      });
      const data = await handleResponse<{
        success: boolean;
        count: number;
        orders: OrderDetails[];
      }>(res);
      return data.orders;
    },

    async getMyOrders(phone: string): Promise<OrderDetails[]> {
      const res = await request(`${API_BASE}/orders/my-orders?phone=${encodeURIComponent(phone)}`, {
        headers: getHeaders(),
      });
      const data = await handleResponse<{
        success: boolean;
        count: number;
        orders: OrderDetails[];
      }>(res);
      return data.orders;
    },

    async updateStatus(orderId: string, status: OrderStatus, note?: string): Promise<OrderDetails> {
      const res = await request(`${API_BASE}/orders/${encodeURIComponent(orderId)}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status, note }),
      });
      const data = await handleResponse<{ success: boolean; order: OrderDetails }>(res);
      return data.order;
    },

    async cancel(orderId: string, reason?: string): Promise<OrderDetails> {
      const res = await request(`${API_BASE}/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ reason }),
      });
      const data = await handleResponse<{ success: boolean; order: OrderDetails }>(res);
      return data.order;
    },

    async updateTelemetry(
      orderId: string,
      lat: number,
      lng: number,
      timestamp = new Date().toISOString(),
    ): Promise<void> {
      const res = await request(`${API_BASE}/orders/${encodeURIComponent(orderId)}/telemetry`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ lat, lng, timestamp }),
      });
      await handleResponse<{ success: boolean }>(res);
    },
  },
  users: {
    async list(page: number, pageSize: number, q = '', role?: UserRole): Promise<UserPage> {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize), q });
      if (role) params.set('role', role);
      return handleResponse(
        await request(`${API_BASE}/users?${params}`, { headers: getHeaders() }),
      );
    },
    async update(id: string, dto: UpdateUserDto): Promise<ManagedUser> {
      const data = await handleResponse<{ user: ManagedUser }>(
        await request(`${API_BASE}/users/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify(dto),
        }),
      );
      return data.user;
    },
  },
};
