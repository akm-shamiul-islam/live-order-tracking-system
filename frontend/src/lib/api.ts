import {
  AuthResponse,
  CreateOrderDto,
  OrderDetails,
  OrderStatus,
  UserSummary,
  AuthResponseSchema,
  PublicConfigSchema,
  type PublicConfig,
} from '@kitchentodoor/shared';
import { clearSession, getSession, saveSession } from './authSession';
import { clientSettings } from './clientSettings';

const API_BASE = '/api';

function getHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
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
    const response = await fetch(url, {
      ...options,
      signal: options.signal ?? AbortSignal.timeout(clientSettings.VITE_REQUEST_TIMEOUT_MS),
    });
    const authorization = new Headers(options.headers).get('Authorization');
    if (
      response.status === 401 &&
      authorization &&
      authorization === `Bearer ${getSession().token}`
    ) {
      clearSession();
    }
    return response;
  } catch {
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
    async login(email: string, pass: string): Promise<AuthResponse> {
      const res = await request(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      const data = parseAuthResponse(await handleResponse<AuthResponse>(res));
      saveSession(data);
      return data;
    },

    async register(
      name: string,
      email: string,
      pass: string,
      phone: string,
    ): Promise<AuthResponse> {
      const res = await request(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password: pass, phone }),
      });
      const data = parseAuthResponse(await handleResponse<AuthResponse>(res));
      saveSession(data);
      return data;
    },

    async getMe(): Promise<UserSummary> {
      const res = await request(`${API_BASE}/auth/me`, {
        headers: getHeaders(),
      });
      return handleResponse<UserSummary>(res);
    },

    logout() {
      clearSession();
    },
  },

  orders: {
    async create(dto: CreateOrderDto): Promise<{ success: boolean; order: OrderDetails }> {
      const res = await request(`${API_BASE}/orders`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(dto),
      });
      return handleResponse<{ success: boolean; order: OrderDetails }>(res);
    },

    async getById(orderId: string): Promise<OrderDetails> {
      const res = await request(`${API_BASE}/orders/${encodeURIComponent(orderId)}`, {
        headers: getHeaders(),
      });
      const data = await handleResponse<{ success: boolean; order: OrderDetails }>(res);
      return data.order;
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

    async updateTelemetry(orderId: string, lat: number, lng: number): Promise<void> {
      const res = await request(`${API_BASE}/orders/${encodeURIComponent(orderId)}/telemetry`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ lat, lng }),
      });
      await handleResponse<{ success: boolean }>(res);
    },
  },
};
