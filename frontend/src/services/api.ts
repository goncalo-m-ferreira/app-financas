import type {
  ApiTransaction,
  ApiUser,
  AuthPayload,
  CreateTransactionInput,
  DashboardApiData,
  LoginInput,
  RegisterInput,
} from '../types/finance';

type ApiErrorPayload = {
  message?: string;
  details?: unknown;
};

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
  signal?: AbortSignal;
};

const AUTH_TOKEN_STORAGE_KEY = 'app_financas.auth_token';

const fallbackApiBaseUrl = (() => {
  if (typeof window === 'undefined') {
    return 'http://localhost:4010/api';
  }

  return `${window.location.protocol}//${window.location.hostname}:4010/api`;
})();

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? fallbackApiBaseUrl).replace(/\/$/, '');

export class ApiClientError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.details = details;
  }
}

function buildHeaders(options: RequestOptions): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  return headers;
}

async function parseErrorPayload(response: Response): Promise<ApiErrorPayload | null> {
  try {
    return (await response.json()) as ApiErrorPayload;
  } catch {
    return null;
  }
}

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: buildHeaders(options),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  if (!response.ok) {
    const payload = await parseErrorPayload(response);

    throw new ApiClientError(
      payload?.message ?? `Falha no pedido para ${path}`,
      response.status,
      payload?.details,
    );
  }

  return (await response.json()) as T;
}

export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export function saveAuthToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

export function clearAuthToken(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

export async function registerUser(payload: RegisterInput): Promise<AuthPayload> {
  return requestJson<AuthPayload>('/auth/register', {
    method: 'POST',
    body: payload,
  });
}

export async function loginUser(payload: LoginInput): Promise<AuthPayload> {
  return requestJson<AuthPayload>('/auth/login', {
    method: 'POST',
    body: payload,
  });
}

export async function fetchCurrentUser(token: string, signal?: AbortSignal): Promise<ApiUser> {
  return requestJson<ApiUser>('/auth/me', {
    token,
    signal,
  });
}

export async function fetchDashboardData(token: string, signal?: AbortSignal): Promise<DashboardApiData> {
  return requestJson<DashboardApiData>('/dashboard?take=120', {
    token,
    signal,
  });
}

export async function createTransaction(
  token: string,
  payload: CreateTransactionInput,
): Promise<ApiTransaction> {
  return requestJson<ApiTransaction>('/transactions', {
    method: 'POST',
    token,
    body: payload,
  });
}
