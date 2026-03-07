import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../context/AuthContext';
import {
  cancelRecurringRule,
  createRecurringRule,
  fetchExpenseCategories,
  fetchRecurringExecutions,
  fetchRecurringPreview,
  fetchRecurringRules,
  fetchWallets,
  pauseRecurringRule,
  resumeRecurringRule,
  updateRecurringRule,
} from '../services/api';
import type {
  ApiExpenseCategory,
  ApiRecurringExecution,
  ApiRecurringExecutionsResponse,
  ApiRecurringRule,
  ApiWallet,
} from '../types/finance';
import { RecurringRulesPage } from './RecurringRulesPage';

vi.mock('../components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));

vi.mock('../components/layout/PremiumPageHeader', () => ({
  PremiumPageHeader: ({
    title,
    description,
    actions,
  }: {
    title: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
  }) => (
    <header>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      {actions ? <div>{actions}</div> : null}
    </header>
  ),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../services/api', () => ({
  ApiClientError: class ApiClientError extends Error {
    readonly status: number;
    readonly details?: unknown;

    constructor(message: string, status = 400, details?: unknown) {
      super(message);
      this.status = status;
      this.details = details;
    }
  },
  cancelRecurringRule: vi.fn(),
  createRecurringRule: vi.fn(),
  fetchExpenseCategories: vi.fn(),
  fetchRecurringExecutions: vi.fn(),
  fetchRecurringPreview: vi.fn(),
  fetchRecurringRules: vi.fn(),
  fetchWallets: vi.fn(),
  pauseRecurringRule: vi.fn(),
  resumeRecurringRule: vi.fn(),
  updateRecurringRule: vi.fn(),
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

const walletFixture: ApiWallet = {
  id: 'wallet-1',
  userId: 'user-1',
  name: 'Main Wallet',
  balance: '1200.00',
  color: '#0ea5e9',
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
};

const categoryFixture: ApiExpenseCategory = {
  id: 'category-1',
  userId: 'user-1',
  name: 'Bills',
  color: '#1f2937',
  icon: 'home',
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
};

function buildRule(overrides: Partial<ApiRecurringRule> = {}): ApiRecurringRule {
  return {
    id: 'rule-1',
    userId: 'user-1',
    walletId: walletFixture.id,
    categoryId: categoryFixture.id,
    type: 'EXPENSE',
    amount: '45.00',
    description: 'Recurring rent',
    isSubscription: false,
    timezone: 'Europe/Lisbon',
    frequency: 'MONTHLY',
    startAt: '2026-01-01T09:00:00.000Z',
    nextRunAt: '2026-03-15T09:00:00.000Z',
    anchorDayOfMonth: 15,
    anchorWeekday: null,
    anchorMonthOfYear: null,
    anchorMinuteOfDay: 540,
    isLastDayAnchor: false,
    endMode: 'NONE',
    endAt: null,
    maxOccurrences: null,
    occurrencesGenerated: 2,
    status: 'ACTIVE',
    pausedReason: null,
    cancelledAt: null,
    lastSuccessfulRunAt: '2026-02-15T09:00:00.000Z',
    lastFailureAt: null,
    failureCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    wallet: {
      id: walletFixture.id,
      name: walletFixture.name,
      color: walletFixture.color,
    },
    category: {
      id: categoryFixture.id,
      name: categoryFixture.name,
      color: categoryFixture.color,
      icon: categoryFixture.icon,
    },
    ...overrides,
  };
}

function buildExecution(
  id: string,
  ruleLabel: string,
  scheduledFor: string,
  options: {
    status?: ApiRecurringExecution['status'];
    nextRuleStatus?: ApiRecurringExecution['rule'] extends { status: infer S } ? S : never;
  } = {},
): ApiRecurringExecution {
  return {
    id,
    userId: 'user-1',
    ruleId: 'rule-1',
    scheduledFor,
    status: options.status ?? 'SUCCESS',
    attemptCount: 1,
    attemptedAt: scheduledFor,
    errorType: null,
    errorMessage: null,
    createdAt: scheduledFor,
    updatedAt: scheduledFor,
    rule: {
      id: 'rule-1',
      description: ruleLabel,
      type: 'EXPENSE',
      amount: '45.00',
      status: options.nextRuleStatus ?? 'ACTIVE',
      pausedReason: null,
      frequency: 'MONTHLY',
      timezone: 'Europe/Lisbon',
      wallet: {
        id: walletFixture.id,
        name: walletFixture.name,
        color: walletFixture.color,
      },
      category: {
        id: categoryFixture.id,
        name: categoryFixture.name,
        color: categoryFixture.color,
        icon: categoryFixture.icon,
      },
    },
    transaction: {
      id: `tx-${id}`,
      type: 'EXPENSE',
      amount: '45.00',
      transactionDate: scheduledFor,
      wallet: {
        id: walletFixture.id,
        name: walletFixture.name,
        color: walletFixture.color,
      },
      category: {
        id: categoryFixture.id,
        name: categoryFixture.name,
        color: categoryFixture.color,
        icon: categoryFixture.icon,
      },
    },
  };
}

function historyResponse(items: ApiRecurringExecution[], nextCursor: string | null): ApiRecurringExecutionsResponse {
  return {
    items,
    nextCursor,
  };
}

const mockedUseAuth = vi.mocked(useAuth);
const fetchRecurringRulesMock = vi.mocked(fetchRecurringRules);
const fetchWalletsMock = vi.mocked(fetchWallets);
const fetchExpenseCategoriesMock = vi.mocked(fetchExpenseCategories);
const fetchRecurringExecutionsMock = vi.mocked(fetchRecurringExecutions);
const fetchRecurringPreviewMock = vi.mocked(fetchRecurringPreview);
const createRecurringRuleMock = vi.mocked(createRecurringRule);
const updateRecurringRuleMock = vi.mocked(updateRecurringRule);
const pauseRecurringRuleMock = vi.mocked(pauseRecurringRule);
const resumeRecurringRuleMock = vi.mocked(resumeRecurringRule);
const cancelRecurringRuleMock = vi.mocked(cancelRecurringRule);

describe('RecurringRulesPage smoke', () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      token: 'token-test',
      user: {
        id: 'user-1',
        name: 'Test User',
        email: 'test@app.local',
        role: 'USER',
        defaultCurrency: 'EUR',
        avatarUrl: null,
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
      isAuthenticated: true,
      isAdmin: false,
      isInitializing: false,
      login: vi.fn(),
      loginWithGoogleCredential: vi.fn(),
      register: vi.fn(),
      setAuthenticatedUser: vi.fn(),
      logout: vi.fn(),
    });

    fetchRecurringRulesMock.mockResolvedValue([buildRule()]);
    fetchWalletsMock.mockResolvedValue([walletFixture]);
    fetchExpenseCategoriesMock.mockResolvedValue([categoryFixture]);
    fetchRecurringExecutionsMock.mockResolvedValue(historyResponse([], null));
    fetchRecurringPreviewMock.mockResolvedValue({
      ruleId: 'rule-1',
      timezone: 'Europe/Lisbon',
      nextRunAt: '2026-03-15T09:00:00.000Z',
      occurrences: ['2026-03-15T09:00:00.000Z'],
    });

    createRecurringRuleMock.mockResolvedValue(buildRule());
    updateRecurringRuleMock.mockResolvedValue(buildRule());
    pauseRecurringRuleMock.mockResolvedValue(
      buildRule({ status: 'PAUSED', nextRunAt: null, pausedReason: 'Manual pause' }),
    );
    resumeRecurringRuleMock.mockResolvedValue(buildRule());
    cancelRecurringRuleMock.mockResolvedValue(
      buildRule({ status: 'CANCELLED', nextRunAt: null, cancelledAt: '2026-03-07T11:00:00.000Z' }),
    );
  });

  it('renders and switches between Rules and Execution History segments', async () => {
    const user = userEvent.setup();

    render(<RecurringRulesPage />);

    await waitFor(() => {
      expect(fetchRecurringRulesMock).toHaveBeenCalledTimes(1);
    });

    const rulesTab = screen.getByRole('tab', { name: 'Rules' });
    const historyTab = screen.getByRole('tab', { name: 'Execution History' });

    expect(historyTab.getAttribute('aria-selected')).toBe('false');
    await user.click(historyTab);

    await waitFor(() => {
      expect(fetchRecurringExecutionsMock).toHaveBeenCalledTimes(1);
    });
    expect(historyTab.getAttribute('aria-selected')).toBe('true');

    await user.click(rulesTab);
    expect(rulesTab.getAttribute('aria-selected')).toBe('true');
  });

  it('opens create modal, shows create preview-disabled message, and closes', async () => {
    const user = userEvent.setup();

    render(<RecurringRulesPage />);

    await waitFor(() => {
      expect(fetchRecurringRulesMock).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('button', { name: 'Add Rule' }));

    expect(screen.getByRole('heading', { name: 'Add Recurring Rule' })).toBeTruthy();
    expect(screen.getByText('Preview will be available after the first save.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Add Recurring Rule' })).toBeNull();
    });
  });

  it('locks row action while pause request is pending and prevents duplicate interaction', async () => {
    const user = userEvent.setup();
    const deferredPause = createDeferred<ApiRecurringRule>();

    fetchRecurringRulesMock.mockResolvedValueOnce([buildRule({ id: 'rule-pending' })]);
    pauseRecurringRuleMock.mockReturnValueOnce(deferredPause.promise);

    render(<RecurringRulesPage />);

    await waitFor(() => {
      expect(fetchRecurringRulesMock).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('button', { name: 'Pause' }));

    await waitFor(() => {
      expect(pauseRecurringRuleMock).toHaveBeenCalledTimes(1);
    });

    const pausingButton = screen.getByRole('button', { name: 'Pausing...' }) as HTMLButtonElement;
    expect(pausingButton.disabled).toBe(true);

    await user.click(pausingButton);
    expect(pauseRecurringRuleMock).toHaveBeenCalledTimes(1);

    deferredPause.resolve(
      buildRule({
        id: 'rule-pending',
        status: 'PAUSED',
        nextRunAt: null,
        pausedReason: 'Manual pause',
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeTruthy();
    });
  });

  it('shows inline error feedback when row action fails', async () => {
    const user = userEvent.setup();

    pauseRecurringRuleMock.mockRejectedValueOnce(new Error('Pause failed smoke'));

    render(<RecurringRulesPage />);

    await waitFor(() => {
      expect(fetchRecurringRulesMock).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('button', { name: 'Pause' }));

    await waitFor(() => {
      expect(screen.getByText('Pause failed smoke')).toBeTruthy();
    });
  });

  it('resets history list and cursor behavior when history status filter changes', async () => {
    const user = userEvent.setup();

    fetchRecurringExecutionsMock
      .mockResolvedValueOnce(
        historyResponse(
          [buildExecution('exec-initial', 'Initial history rule', '2026-03-05T09:00:00.000Z')],
          'cursor-initial',
        ),
      )
      .mockResolvedValueOnce(
        historyResponse(
          [buildExecution('exec-filtered', 'Filtered history rule', '2026-03-06T09:00:00.000Z')],
          null,
        ),
      );

    render(<RecurringRulesPage />);

    await waitFor(() => {
      expect(fetchRecurringRulesMock).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('tab', { name: 'Execution History' }));

    await waitFor(() => {
      expect(screen.getByText('Initial history rule')).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: 'Load more' })).toBeTruthy();

    await user.selectOptions(screen.getByLabelText('Status'), 'FAILED');

    await waitFor(() => {
      expect(fetchRecurringExecutionsMock).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByText('Filtered history rule')).toBeTruthy();
    });

    expect(screen.queryByText('Initial history rule')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
    expect(fetchRecurringExecutionsMock.mock.calls[1]?.[1]).toMatchObject({
      status: 'FAILED',
    });
    expect((fetchRecurringExecutionsMock.mock.calls[1]?.[1] as { cursor?: string }).cursor).toBeUndefined();
  });

  it('appends history rows when load more succeeds', async () => {
    const user = userEvent.setup();

    fetchRecurringExecutionsMock
      .mockResolvedValueOnce(
        historyResponse(
          [buildExecution('exec-1', 'History base rule', '2026-03-05T09:00:00.000Z')],
          'cursor-more',
        ),
      )
      .mockResolvedValueOnce(
        historyResponse(
          [buildExecution('exec-2', 'History appended rule', '2026-03-06T09:00:00.000Z')],
          null,
        ),
      );

    render(<RecurringRulesPage />);

    await waitFor(() => {
      expect(fetchRecurringRulesMock).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('tab', { name: 'Execution History' }));

    await waitFor(() => {
      expect(screen.getByText('History base rule')).toBeTruthy();
    });

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    await waitFor(() => {
      expect(fetchRecurringExecutionsMock).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByText('History appended rule')).toBeTruthy();
    });

    expect(screen.getByText('History base rule')).toBeTruthy();
    expect(fetchRecurringExecutionsMock.mock.calls[1]?.[1]).toMatchObject({
      cursor: 'cursor-more',
    });
  });

  it('keeps loaded rows and exposes retry affordance when load more fails', async () => {
    const user = userEvent.setup();

    fetchRecurringExecutionsMock
      .mockResolvedValueOnce(
        historyResponse(
          [buildExecution('exec-1', 'History existing rule', '2026-03-05T09:00:00.000Z')],
          'cursor-fail',
        ),
      )
      .mockRejectedValueOnce(new Error('Next page failed'))
      .mockResolvedValueOnce(
        historyResponse(
          [buildExecution('exec-2', 'Recovered history rule', '2026-03-06T09:00:00.000Z')],
          null,
        ),
      );

    render(<RecurringRulesPage />);

    await waitFor(() => {
      expect(fetchRecurringRulesMock).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('tab', { name: 'Execution History' }));

    await waitFor(() => {
      expect(screen.getByText('History existing rule')).toBeTruthy();
    });

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    await waitFor(() => {
      expect(screen.getByText('Next page failed')).toBeTruthy();
    });
    expect(screen.getByText('History existing rule')).toBeTruthy();

    const retryButton = screen.getByRole('button', { name: 'Retry load more' });
    expect(retryButton).toBeTruthy();

    await user.click(retryButton);

    await waitFor(() => {
      expect(fetchRecurringExecutionsMock).toHaveBeenCalledTimes(3);
    });
    await waitFor(() => {
      expect(screen.getByText('Recovered history rule')).toBeTruthy();
    });
    expect(screen.getByText('History existing rule')).toBeTruthy();
  });
});
