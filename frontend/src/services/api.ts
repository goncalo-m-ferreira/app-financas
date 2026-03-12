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
  NotificationsListResponse,
  NotificationsMarkAllAsReadResponse,
  NotificationsQueryInput,
  NotificationsUnreadCountResponse,
  RegisterInput,
  RecurringExecutionStatus,
  RecurringPreviewResponse,
  RecurringRuleStatus,
  ReportsQueryInput,
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

const CSRF_COOKIE_NAME = 'app_financas_csrf';

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

function isUnsafeMethod(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const prefix = `${name}=`;
  const cookie = document.cookie
    .split(';')
    .map((segment) => segment.trim())
    .find((segment) => segment.startsWith(prefix));

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(cookie.slice(prefix.length));
}

function buildHeaders(options: RequestOptions, method: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (options.body !== undefined && !isFormData(options.body)) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.token && options.token.includes('.')) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  if (isUnsafeMethod(method)) {
    const csrfToken = readCookie(CSRF_COOKIE_NAME);

    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken;
    }
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

function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
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
  const method = options.method ?? 'GET';
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: buildHeaders(options, method),
    body:
      options.body === undefined
        ? undefined
        : isFormData(options.body)
          ? options.body
          : JSON.stringify(options.body),
    signal: options.signal,
    credentials: 'include',
  });

  if (!response.ok) {
    const payload = await parseErrorPayload(response);

    throw new ApiClientError(buildApiErrorMessage(path, payload), response.status, payload?.details);
  }

  return (await response.json()) as T;
}

async function requestBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const method = options.method ?? 'GET';
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: buildHeaders(options, method),
    body:
      options.body === undefined
        ? undefined
        : isFormData(options.body)
          ? options.body
          : JSON.stringify(options.body),
    signal: options.signal,
    credentials: 'include',
  });

  if (!response.ok) {
    const payload = await parseErrorPayload(response);

    throw new ApiClientError(buildApiErrorMessage(path, payload), response.status, payload?.details);
  }

  return response.blob();
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

export async function fetchCurrentUser(token?: string, signal?: AbortSignal): Promise<ApiUser> {
  return requestJson<ApiUser>('/auth/me', {
    token,
    signal,
  });
}

export async function logoutSession(token?: string): Promise<{ success: boolean }> {
  return requestJson<{ success: boolean }>('/auth/logout', {
    method: 'POST',
    token,
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

export async function fetchReports(
  token: string,
  filters: ReportsQueryInput = {},
  signal?: AbortSignal,
): Promise<ApiReport[]> {
  const queryString = buildQueryString({
    status: filters.status,
    month: filters.month,
    year: filters.year,
  });

  return requestJson<ApiReport[]>(`/reports${queryString}`, {
    token,
    signal,
  });
}

export async function fetchNotifications(
  token: string,
  filters: NotificationsQueryInput = {},
  signal?: AbortSignal,
): Promise<NotificationsListResponse> {
  const queryString = buildQueryString({
    isRead: filters.isRead,
    type: filters.type,
    take: filters.take,
    cursor: filters.cursor,
  });

  return requestJson<NotificationsListResponse>(`/notifications${queryString}`, {
    token,
    signal,
  });
}

export async function fetchUnreadNotificationsCount(
  token: string,
  signal?: AbortSignal,
): Promise<NotificationsUnreadCountResponse> {
  return requestJson<NotificationsUnreadCountResponse>('/notifications/unread-count', {
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

export async function markAllNotificationsAsRead(
  token: string,
): Promise<NotificationsMarkAllAsReadResponse> {
  return requestJson<NotificationsMarkAllAsReadResponse>('/notifications/read-all', {
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

export async function regenerateReport(token: string, reportId: string): Promise<ApiReport> {
  return requestJson<ApiReport>(`/reports/${reportId}/regenerate`, {
    method: 'POST',
    token,
  });
}

export async function downloadReport(token: string, reportId: string): Promise<Blob> {
  return requestBlob(`/reports/${reportId}/download`, {
    token,
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
