import type {
  ApiBudget,
  ApiExpenseCategory,
  ApiNotification,
  ApiReport,
  ApiTransaction,
  ApiUser,
  ApiWallet,
  AuthPayload,
  BudgetOverview,
  CreateBudgetInput,
  CreateExpenseCategoryInput,
  CreateReportInput,
  CreateTransactionInput,
  CreateWalletInput,
  DashboardApiData,
  GoogleAuthInput,
  HomeInsightsResponse,
  ImportTransactionsInput,
  ImportTransactionsResult,
  LoginInput,
  MonthYearFilter,
  RegisterInput,
  UpdateTransactionInput,
  UpdateWalletInput,
} from '../types/finance';

type ApiErrorPayload = {
  message?: string;
  details?: unknown;
};

type ApiValidationDetail = {
  path?: string;
  message?: string;
};

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
  signal?: AbortSignal;
};

const AUTH_TOKEN_STORAGE_KEY = 'app_financas.auth_token';

const fallbackApiUrl = 'http://localhost:4010';
const apiUrl = (import.meta.env.VITE_API_URL ?? fallbackApiUrl).replace(/\/$/, '');
const API_BASE_URL = apiUrl.endsWith('/api') ? apiUrl : `${apiUrl}/api`;

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

  if (options.body !== undefined && !isFormData(options.body)) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  return headers;
}

function isFormData(body: unknown): body is FormData {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

async function parseErrorPayload(response: Response): Promise<ApiErrorPayload | null> {
  try {
    return (await response.json()) as ApiErrorPayload;
  } catch {
    return null;
  }
}

function buildApiErrorMessage(path: string, payload: ApiErrorPayload | null): string {
  const fallbackMessage = payload?.message ?? `Falha no pedido para ${path}`;

  if (!Array.isArray(payload?.details)) {
    return fallbackMessage;
  }

  const firstDetail = payload.details[0] as ApiValidationDetail | undefined;

  if (!firstDetail?.message) {
    return fallbackMessage;
  }

  if (firstDetail.path) {
    return `${fallbackMessage} (${firstDetail.path}: ${firstDetail.message})`;
  }

  return `${fallbackMessage} (${firstDetail.message})`;
}

function buildQueryString(params: Record<string, string | number | undefined>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    searchParams.set(key, String(value));
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: buildHeaders(options),
    body:
      options.body === undefined
        ? undefined
        : isFormData(options.body)
          ? options.body
          : JSON.stringify(options.body),
    signal: options.signal,
  });

  if (!response.ok) {
    const payload = await parseErrorPayload(response);

    throw new ApiClientError(buildApiErrorMessage(path, payload), response.status, payload?.details);
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

export async function loginWithGoogle(payload: GoogleAuthInput): Promise<AuthPayload> {
  return requestJson<AuthPayload>('/auth/google', {
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

export async function fetchDashboardData(
  token: string,
  period: MonthYearFilter,
  search?: string,
  signal?: AbortSignal,
): Promise<DashboardApiData> {
  const queryString = buildQueryString({
    month: period.month,
    year: period.year,
    search: search?.trim() || undefined,
  });

  return requestJson<DashboardApiData>(`/dashboard${queryString}`, {
    token,
    signal,
  });
}

export async function fetchExpenseCategories(
  token: string,
  signal?: AbortSignal,
): Promise<ApiExpenseCategory[]> {
  return requestJson<ApiExpenseCategory[]>('/expense-categories', {
    token,
    signal,
  });
}

export async function fetchWallets(token: string, signal?: AbortSignal): Promise<ApiWallet[]> {
  return requestJson<ApiWallet[]>('/wallets', {
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

export async function updateTransaction(
  token: string,
  transactionId: string,
  payload: UpdateTransactionInput,
): Promise<ApiTransaction> {
  return requestJson<ApiTransaction>(`/transactions/${transactionId}`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export async function deleteTransaction(
  token: string,
  transactionId: string,
): Promise<ApiTransaction> {
  return requestJson<ApiTransaction>(`/transactions/${transactionId}`, {
    method: 'DELETE',
    token,
  });
}

export async function importTransactionsCsv(
  token: string,
  payload: ImportTransactionsInput,
  signal?: AbortSignal,
): Promise<ImportTransactionsResult> {
  const formData = new FormData();
  formData.set('walletId', payload.walletId);
  formData.set('file', payload.file);

  return requestJson<ImportTransactionsResult>('/transactions/import', {
    method: 'POST',
    token,
    body: formData,
    signal,
  });
}

export async function createWallet(token: string, payload: CreateWalletInput): Promise<ApiWallet> {
  return requestJson<ApiWallet>('/wallets', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function fetchReports(token: string, signal?: AbortSignal): Promise<ApiReport[]> {
  return requestJson<ApiReport[]>('/reports', {
    token,
    signal,
  });
}

export async function fetchNotifications(
  token: string,
  signal?: AbortSignal,
): Promise<ApiNotification[]> {
  return requestJson<ApiNotification[]>('/notifications', {
    token,
    signal,
  });
}

export async function markNotificationAsRead(
  token: string,
  notificationId: string,
): Promise<ApiNotification> {
  return requestJson<ApiNotification>(`/notifications/${notificationId}/read`, {
    method: 'PATCH',
    token,
  });
}

export async function createReport(token: string, payload: CreateReportInput): Promise<ApiReport> {
  return requestJson<ApiReport>('/reports', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function updateWallet(
  token: string,
  walletId: string,
  payload: UpdateWalletInput,
): Promise<ApiWallet> {
  return requestJson<ApiWallet>(`/wallets/${walletId}`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export async function deleteWallet(token: string, walletId: string): Promise<ApiWallet> {
  return requestJson<ApiWallet>(`/wallets/${walletId}`, {
    method: 'DELETE',
    token,
  });
}

export async function fetchTransactions(
  token: string,
  period: MonthYearFilter,
  search?: string,
  signal?: AbortSignal,
): Promise<ApiTransaction[]> {
  const queryString = buildQueryString({
    month: period.month,
    year: period.year,
    search: search?.trim() || undefined,
  });

  return requestJson<ApiTransaction[]>(`/transactions${queryString}`, {
    token,
    signal,
  });
}

export async function fetchBudgets(
  token: string,
  period: MonthYearFilter,
  signal?: AbortSignal,
): Promise<BudgetOverview> {
  const queryString = buildQueryString({
    month: period.month,
    year: period.year,
  });

  return requestJson<BudgetOverview>(`/budgets${queryString}`, {
    token,
    signal,
  });
}

export async function createBudget(token: string, payload: CreateBudgetInput): Promise<ApiBudget> {
  return requestJson<ApiBudget>('/budgets', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function createExpenseCategory(
  token: string,
  payload: CreateExpenseCategoryInput,
): Promise<ApiExpenseCategory> {
  return requestJson<ApiExpenseCategory>('/expense-categories', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function deleteExpenseCategory(
  token: string,
  categoryId: string,
): Promise<ApiExpenseCategory> {
  return requestJson<ApiExpenseCategory>(`/expense-categories/${categoryId}`, {
    method: 'DELETE',
    token,
  });
}

export async function fetchHomeInsights(
  token: string,
  period: MonthYearFilter,
  signal?: AbortSignal,
): Promise<HomeInsightsResponse> {
  const queryString = buildQueryString({
    month: period.month,
    year: period.year,
  });

  return requestJson<HomeInsightsResponse>(`/home/insights${queryString}`, {
    token,
    signal,
  });
}
