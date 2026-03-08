import type {
  AdminOverviewResponse,
  AdminRecurringOperationIssueType,
  AdminRecurringOperationsResponse,
  ApiBudget,
  ApiExpenseCategory,
  ApiNotification,
  ApiRecurringExecutionsResponse,
  ApiRecurringRule,
  ApiReport,
  ApiTransaction,
  ApiUser,
  ApiWallet,
  AuthPayload,
  BudgetOverview,
  DeleteCurrentUserResponse,
  CreateBudgetInput,
  CreateExpenseCategoryInput,
  CreateReportInput,
  CreateRecurringRuleInput,
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
  RecurringExecutionStatus,
  RecurringPreviewResponse,
  RecurringRuleStatus,
  UpdateCurrentUserInput,
  UpdateBudgetInput,
  UpdateRecurringRuleInput,
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
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
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

export async function updateCurrentUser(
  token: string,
  payload: UpdateCurrentUserInput,
): Promise<ApiUser> {
  return requestJson<ApiUser>('/users/me', {
    method: 'PUT',
    token,
    body: payload,
  });
}

export async function deleteCurrentUser(token: string): Promise<DeleteCurrentUserResponse> {
  return requestJson<DeleteCurrentUserResponse>('/users/me', {
    method: 'DELETE',
    token,
  });
}

export async function fetchAdminOverview(
  token: string,
  take = 20,
  signal?: AbortSignal,
): Promise<AdminOverviewResponse> {
  const queryString = buildQueryString({ take });

  return requestJson<AdminOverviewResponse>(`/admin/overview${queryString}`, {
    token,
    signal,
  });
}

export async function fetchAdminRecurringOperations(
  token: string,
  options: {
    take?: number;
    issueType?: AdminRecurringOperationIssueType;
  } = {},
  signal?: AbortSignal,
): Promise<AdminRecurringOperationsResponse> {
  const queryString = buildQueryString({
    take: options.take,
    issueType: options.issueType,
  });

  return requestJson<AdminRecurringOperationsResponse>(`/admin/recurring-operations${queryString}`, {
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

export async function updateBudget(
  token: string,
  budgetId: string,
  payload: UpdateBudgetInput,
): Promise<ApiBudget> {
  return requestJson<ApiBudget>(`/budgets/${budgetId}`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export async function deleteBudget(token: string, budgetId: string): Promise<ApiBudget> {
  return requestJson<ApiBudget>(`/budgets/${budgetId}`, {
    method: 'DELETE',
    token,
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

export async function fetchRecurringRules(
  token: string,
  status?: RecurringRuleStatus,
  signal?: AbortSignal,
): Promise<ApiRecurringRule[]> {
  const queryString = buildQueryString({
    status,
  });

  return requestJson<ApiRecurringRule[]>(`/recurring-rules${queryString}`, {
    token,
    signal,
  });
}

export async function createRecurringRule(
  token: string,
  payload: CreateRecurringRuleInput,
): Promise<ApiRecurringRule> {
  return requestJson<ApiRecurringRule>('/recurring-rules', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function updateRecurringRule(
  token: string,
  ruleId: string,
  payload: UpdateRecurringRuleInput,
): Promise<ApiRecurringRule> {
  return requestJson<ApiRecurringRule>(`/recurring-rules/${ruleId}`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export async function pauseRecurringRule(
  token: string,
  ruleId: string,
  reason?: string,
): Promise<ApiRecurringRule> {
  return requestJson<ApiRecurringRule>(`/recurring-rules/${ruleId}/pause`, {
    method: 'POST',
    token,
    body: {
      reason,
    },
  });
}

export async function resumeRecurringRule(token: string, ruleId: string): Promise<ApiRecurringRule> {
  return requestJson<ApiRecurringRule>(`/recurring-rules/${ruleId}/resume`, {
    method: 'POST',
    token,
  });
}

export async function cancelRecurringRule(token: string, ruleId: string): Promise<ApiRecurringRule> {
  return requestJson<ApiRecurringRule>(`/recurring-rules/${ruleId}`, {
    method: 'DELETE',
    token,
  });
}

export async function fetchRecurringPreview(
  token: string,
  ruleId: string,
  count = 12,
  signal?: AbortSignal,
): Promise<RecurringPreviewResponse> {
  const queryString = buildQueryString({
    count,
  });

  return requestJson<RecurringPreviewResponse>(`/recurring-rules/${ruleId}/preview${queryString}`, {
    token,
    signal,
  });
}

export async function fetchRecurringExecutions(
  token: string,
  options: {
    ruleId?: string;
    status?: RecurringExecutionStatus;
    take?: number;
    cursor?: string;
  } = {},
  signal?: AbortSignal,
): Promise<ApiRecurringExecutionsResponse> {
  const queryString = buildQueryString({
    ruleId: options.ruleId,
    status: options.status,
    take: options.take,
    cursor: options.cursor,
  });

  return requestJson<ApiRecurringExecutionsResponse>(`/recurring-executions${queryString}`, {
    token,
    signal,
  });
}
