import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../context/AuthContext';
import { useDateFilter } from '../context/DateFilterContext';
import {
  createTransaction,
  deleteTransaction,
  fetchExpenseCategories,
  fetchHomeInsights,
  fetchWallets,
  updateTransaction,
} from '../services/api';
import type {
  ApiExpenseCategory,
  ApiTransaction,
  ApiWallet,
  HomeInsightsResponse,
} from '../types/finance';
import { HomePage } from './HomePage';

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

vi.mock('../context/DateFilterContext', () => ({
  useDateFilter: vi.fn(),
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
  createTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  fetchExpenseCategories: vi.fn(),
  fetchHomeInsights: vi.fn(),
  fetchWallets: vi.fn(),
  updateTransaction: vi.fn(),
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
  balance: '1000.00',
  color: '#0ea5e9',
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
};

const categoryFixture: ApiExpenseCategory = {
  id: 'category-1',
  userId: 'user-1',
  name: 'Bills',
  color: '#111827',
  icon: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
};

function buildTransaction(overrides: Partial<ApiTransaction> = {}): ApiTransaction {
  return {
    id: 'transaction-1',
    userId: 'user-1',
    categoryId: categoryFixture.id,
    walletId: walletFixture.id,
    type: 'EXPENSE',
    amount: '25.00',
    description: 'Old transaction',
    transactionDate: '2026-03-08T10:00:00.000Z',
    createdAt: '2026-03-08T10:00:00.000Z',
    updatedAt: '2026-03-08T10:00:00.000Z',
    category: {
      id: categoryFixture.id,
      name: categoryFixture.name,
      color: categoryFixture.color,
      icon: categoryFixture.icon,
    },
    wallet: {
      id: walletFixture.id,
      name: walletFixture.name,
      color: walletFixture.color,
    },
    ...overrides,
  };
}

function buildInsights(overrides: Partial<HomeInsightsResponse> = {}): HomeInsightsResponse {
  return {
    period: {
      month: 3,
      year: 2026,
      start: '2026-03-01T00:00:00.000Z',
      endExclusive: '2026-04-01T00:00:00.000Z',
    },
    recentTransactions: [buildTransaction()],
    monthlySummary: {
      incomeThisMonth: '2000.00',
      spentThisMonth: '320.00',
      netThisMonth: '1680.00',
      transactionCount: 4,
    },
    budgetStatus: {
      totalBudgets: 3,
      warningCount: 1,
      criticalCount: 1,
      exceededCount: 1,
      hasAlerts: true,
      items: [],
    },
    recurringStatus: {
      pausedCount: 1,
      dueSoonCount: 2,
      failedRecentCount: 1,
      needsAttentionCount: 2,
      hasIssues: true,
    },
    ...overrides,
  };
}

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseDateFilter = vi.mocked(useDateFilter);
const fetchHomeInsightsMock = vi.mocked(fetchHomeInsights);
const fetchWalletsMock = vi.mocked(fetchWallets);
const fetchExpenseCategoriesMock = vi.mocked(fetchExpenseCategories);
const createTransactionMock = vi.mocked(createTransaction);
const updateTransactionMock = vi.mocked(updateTransaction);
const deleteTransactionMock = vi.mocked(deleteTransaction);

function renderHomePage(): void {
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

describe('HomePage smoke', () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      token: 'token-home',
      user: {
        id: 'user-1',
        name: 'Home User',
        email: 'home.user@app.local',
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

    mockedUseDateFilter.mockReturnValue({
      month: 3,
      year: 2026,
      setMonth: vi.fn(),
      setYear: vi.fn(),
    });

    fetchHomeInsightsMock.mockResolvedValue(buildInsights());
    fetchWalletsMock.mockResolvedValue([walletFixture]);
    fetchExpenseCategoriesMock.mockResolvedValue([categoryFixture]);

    createTransactionMock.mockResolvedValue(buildTransaction({ id: 'created-1' }));
    updateTransactionMock.mockResolvedValue(buildTransaction({ id: 'updated-1' }));
    deleteTransactionMock.mockResolvedValue(buildTransaction({ id: 'deleted-1' }));
  });

  it('renders key command-center sections with concise actionable insights links', async () => {
    renderHomePage();

    await waitFor(() => {
      expect(fetchHomeInsightsMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('heading', { name: /Welcome back, Home User/i })).toBeTruthy();
    expect(screen.getByText('Spent This Month')).toBeTruthy();
    expect(screen.getByText('Wallet Total (All Wallets)')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Recent Transactions' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Insights / Alerts' })).toBeTruthy();

    const budgetsLink = screen.getByRole('link', { name: 'Go to Budgets' });
    const recurringLink = screen.getByRole('link', { name: 'Go to Recurring Rules' });

    expect(budgetsLink.getAttribute('href')).toBe('/budgets');
    expect(recurringLink.getAttribute('href')).toBe('/recurring-rules');
  });

  it('prevents duplicate submit while creating and refreshes command-center data canonically', async () => {
    const user = userEvent.setup();
    const deferredCreate = createDeferred<ApiTransaction>();

    fetchHomeInsightsMock
      .mockResolvedValueOnce(
        buildInsights({
          recentTransactions: [buildTransaction({ id: 'tx-old', description: 'Old transaction' })],
          monthlySummary: {
            incomeThisMonth: '2000.00',
            spentThisMonth: '320.00',
            netThisMonth: '1680.00',
            transactionCount: 4,
          },
        }),
      )
      .mockResolvedValueOnce(
        buildInsights({
          recentTransactions: [buildTransaction({ id: 'tx-new', description: 'Coffee' })],
          monthlySummary: {
            incomeThisMonth: '2000.00',
            spentThisMonth: '345.00',
            netThisMonth: '1655.00',
            transactionCount: 5,
          },
        }),
      );

    fetchWalletsMock
      .mockResolvedValueOnce([walletFixture])
      .mockResolvedValueOnce([
        {
          ...walletFixture,
          balance: '975.00',
        },
      ]);

    createTransactionMock.mockReturnValueOnce(deferredCreate.promise);

    renderHomePage();

    await waitFor(() => {
      expect(fetchHomeInsightsMock).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('button', { name: 'Add Transaction' }));

    await user.type(screen.getByLabelText('Amount'), '25');
    await user.type(screen.getByLabelText('Description'), 'Coffee');
    await user.selectOptions(screen.getByLabelText('Category'), categoryFixture.id);

    await user.click(screen.getByRole('button', { name: 'Create transaction' }));

    await waitFor(() => {
      expect(createTransactionMock).toHaveBeenCalledTimes(1);
    });

    const savingButton = screen.getByRole('button', { name: 'Saving...' }) as HTMLButtonElement;
    expect(savingButton.disabled).toBe(true);

    await user.click(savingButton);
    expect(createTransactionMock).toHaveBeenCalledTimes(1);

    deferredCreate.resolve(
      buildTransaction({
        id: 'tx-created',
        description: 'Coffee',
        amount: '25.00',
      }),
    );

    await waitFor(() => {
      expect(fetchHomeInsightsMock).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(fetchWalletsMock).toHaveBeenCalledTimes(2);
    });

    expect(fetchExpenseCategoriesMock).toHaveBeenCalledTimes(1);

    expect(screen.getByText('Coffee')).toBeTruthy();
    expect(screen.getByText('Transaction created successfully.')).toBeTruthy();

    const secondCallPeriod = fetchHomeInsightsMock.mock.calls[1]?.[1];
    expect(secondCallPeriod).toEqual({ month: 3, year: 2026 });
  });

  it('shows load error and retries successfully', async () => {
    const user = userEvent.setup();

    fetchHomeInsightsMock
      .mockRejectedValueOnce(new Error('Home offline'))
      .mockResolvedValueOnce(buildInsights());

    renderHomePage();

    await waitFor(() => {
      expect(screen.getByText('Home offline')).toBeTruthy();
    });

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(fetchHomeInsightsMock).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByRole('heading', { name: 'Recent Transactions' })).toBeTruthy();
  });
});
