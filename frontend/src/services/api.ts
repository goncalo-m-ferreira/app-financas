import type { ApiExpenseCategory, ApiTransaction, ApiUser, DashboardApiData } from '../types/finance';

type ApiErrorPayload = {
  message?: string;
  details?: unknown;
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api').replace(
  /\/$/,
  '',
);

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

async function parseErrorPayload(response: Response): Promise<ApiErrorPayload | null> {
  try {
    const payload = (await response.json()) as ApiErrorPayload;
    return payload;
  } catch {
    return null;
  }
}

async function requestJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
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

export async function fetchDashboardData(signal?: AbortSignal): Promise<DashboardApiData> {
  const users = await requestJson<ApiUser[]>('/users?take=1', signal);
  const user = users[0] ?? null;

  if (!user) {
    return {
      user: null,
      categories: [],
      transactions: [],
    };
  }

  const [categories, transactions] = await Promise.all([
    requestJson<ApiExpenseCategory[]>(`/users/${user.id}/expense-categories`, signal),
    requestJson<ApiTransaction[]>(`/users/${user.id}/transactions?take=80`, signal),
  ]);

  return {
    user,
    categories,
    transactions,
  };
}
