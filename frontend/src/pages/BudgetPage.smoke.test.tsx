import type { ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../context/AuthContext';
import { useDateFilter } from '../context/DateFilterContext';
import {
  createBudget,
  deleteBudget,
  fetchBudgets,
  fetchExpenseCategories,
  updateBudget,
} from '../services/api';
import type { ApiBudget, ApiExpenseCategory, BudgetOverview } from '../types/finance';
import { BudgetPage } from './BudgetPage';

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
  fetchBudgets: vi.fn(),
  fetchExpenseCategories: vi.fn(),
  createBudget: vi.fn(),
  updateBudget: vi.fn(),
  deleteBudget: vi.fn(),
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

function buildBudget(
  overrides: Partial<ApiBudget> & {
    id: string;
    categoryId: string;
    categoryName: string;
    amount: string;
    spentThisMonth: string;
    remaining: string;
    usageRatio: number;
  },
): ApiBudget {
  const {
    id,
    categoryId,
    categoryName,
    amount,
    spentThisMonth,
    remaining,
    usageRatio,
    ...rest
  } = overrides;

  return {
    id,
    userId: 'user-1',
    categoryId,
    amount,
    spentThisMonth,
    remaining,
    usageRatio,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    category: {
      id: categoryId,
      name: categoryName,
      color: '#1f2937',
      icon: null,
    },
    ...rest,
  };
}

function buildOverview(budgets: ApiBudget[]): BudgetOverview {
  return {
    currentMonth: {
      month: 3,
      year: 2026,
      start: '2026-03-01T00:00:00.000Z',
      endExclusive: '2026-04-01T00:00:00.000Z',
    },
    budgets,
  };
}

const categoryBills: ApiExpenseCategory = {
  id: 'category-bills',
  userId: 'user-1',
  name: 'Bills',
  color: '#111827',
  icon: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
};

const categoryFood: ApiExpenseCategory = {
  id: 'category-food',
  userId: 'user-1',
  name: 'Food',
  color: '#0ea5e9',
  icon: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
};

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseDateFilter = vi.mocked(useDateFilter);
const fetchBudgetsMock = vi.mocked(fetchBudgets);
const fetchExpenseCategoriesMock = vi.mocked(fetchExpenseCategories);
const createBudgetMock = vi.mocked(createBudget);
const updateBudgetMock = vi.mocked(updateBudget);
const deleteBudgetMock = vi.mocked(deleteBudget);

function getBudgetCard(categoryName: string): HTMLElement {
  const heading = screen.getByRole('heading', { name: categoryName });
  const card = heading.closest('article');

  if (!card) {
    throw new Error(`Card not found for category ${categoryName}`);
  }

  return card;
}

describe('BudgetPage smoke', () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      token: 'token-budget',
      user: {
        id: 'user-1',
        name: 'Budget User',
        email: 'budget.user@app.local',
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

    fetchBudgetsMock.mockResolvedValue(
      buildOverview([
        buildBudget({
          id: 'budget-bills',
          categoryId: categoryBills.id,
          categoryName: categoryBills.name,
          amount: '100.00',
          spentThisMonth: '45.00',
          remaining: '55.00',
          usageRatio: 0.45,
        }),
      ]),
    );
    fetchExpenseCategoriesMock.mockResolvedValue([categoryBills, categoryFood]);

    createBudgetMock.mockResolvedValue(
      buildBudget({
        id: 'budget-food',
        categoryId: categoryFood.id,
        categoryName: categoryFood.name,
        amount: '80.00',
        spentThisMonth: '20.00',
        remaining: '60.00',
        usageRatio: 0.25,
      }),
    );
    updateBudgetMock.mockResolvedValue(
      buildBudget({
        id: 'budget-bills',
        categoryId: categoryBills.id,
        categoryName: categoryBills.name,
        amount: '150.00',
        spentThisMonth: '45.00',
        remaining: '105.00',
        usageRatio: 0.3,
      }),
    );
    deleteBudgetMock.mockResolvedValue(
      buildBudget({
        id: 'budget-food',
        categoryId: categoryFood.id,
        categoryName: categoryFood.name,
        amount: '80.00',
        spentThisMonth: '20.00',
        remaining: '60.00',
        usageRatio: 0.25,
      }),
    );
  });

  it('renders budget page with existing header and cards', async () => {
    render(<BudgetPage />);

    await waitFor(() => {
      expect(fetchBudgetsMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('heading', { name: 'Budgets' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Bills' })).toBeTruthy();
    expect(screen.getByText('Total limit:')).toBeTruthy();
    expect(screen.getByText('Total spent:')).toBeTruthy();
  });

  it('opens create modal and validates basic input', async () => {
    const user = userEvent.setup();

    render(<BudgetPage />);

    await waitFor(() => {
      expect(fetchBudgetsMock).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('button', { name: 'New Budget' }));
    expect(screen.getByRole('heading', { name: 'New Budget' })).toBeTruthy();

    const amountInput = screen.getByLabelText('Monthly limit');
    await user.clear(amountInput);
    await user.type(amountInput, '0');

    await user.click(screen.getByRole('button', { name: 'Create budget' }));

    expect(screen.getByText('amount must be greater than 0.')).toBeTruthy();
  });

  it('updates visible state through canonical reload after create, edit, and delete', async () => {
    const user = userEvent.setup();

    fetchBudgetsMock
      .mockResolvedValueOnce(
        buildOverview([
          buildBudget({
            id: 'budget-bills',
            categoryId: categoryBills.id,
            categoryName: categoryBills.name,
            amount: '100.00',
            spentThisMonth: '45.00',
            remaining: '55.00',
            usageRatio: 0.45,
          }),
        ]),
      )
      .mockResolvedValueOnce(
        buildOverview([
          buildBudget({
            id: 'budget-bills',
            categoryId: categoryBills.id,
            categoryName: categoryBills.name,
            amount: '100.00',
            spentThisMonth: '45.00',
            remaining: '55.00',
            usageRatio: 0.45,
          }),
          buildBudget({
            id: 'budget-food',
            categoryId: categoryFood.id,
            categoryName: categoryFood.name,
            amount: '80.00',
            spentThisMonth: '20.00',
            remaining: '60.00',
            usageRatio: 0.25,
          }),
        ]),
      )
      .mockResolvedValueOnce(
        buildOverview([
          buildBudget({
            id: 'budget-bills',
            categoryId: categoryBills.id,
            categoryName: categoryBills.name,
            amount: '150.00',
            spentThisMonth: '45.00',
            remaining: '105.00',
            usageRatio: 0.3,
          }),
          buildBudget({
            id: 'budget-food',
            categoryId: categoryFood.id,
            categoryName: categoryFood.name,
            amount: '80.00',
            spentThisMonth: '20.00',
            remaining: '60.00',
            usageRatio: 0.25,
          }),
        ]),
      )
      .mockResolvedValueOnce(
        buildOverview([
          buildBudget({
            id: 'budget-bills',
            categoryId: categoryBills.id,
            categoryName: categoryBills.name,
            amount: '150.00',
            spentThisMonth: '45.00',
            remaining: '105.00',
            usageRatio: 0.3,
          }),
        ]),
      );

    render(<BudgetPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Bills' })).toBeTruthy();
    });

    await user.click(screen.getByRole('button', { name: 'New Budget' }));
    const amountInput = screen.getByLabelText('Monthly limit');
    await user.clear(amountInput);
    await user.type(amountInput, '80');
    await user.click(screen.getByRole('button', { name: 'Create budget' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Food' })).toBeTruthy();
    });

    await user.click(within(getBudgetCard('Bills')).getByRole('button', { name: 'Edit' }));
    const editAmountInput = screen.getByLabelText('Monthly limit');
    await user.clear(editAmountInput);
    await user.type(editAmountInput, '150');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(screen.getByText("150.00 EUR")).toBeTruthy();
    });

    await user.click(within(getBudgetCard('Food')).getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete budget' }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Food' })).toBeNull();
    });
  });

  it('shows local no-op message and blocks update request when amount is unchanged', async () => {
    const user = userEvent.setup();

    render(<BudgetPage />);

    await waitFor(() => {
      expect(fetchBudgetsMock).toHaveBeenCalledTimes(1);
    });

    await user.click(within(getBudgetCard('Bills')).getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.getByText('No changes detected.')).toBeTruthy();
    expect(updateBudgetMock).not.toHaveBeenCalled();
  });

  it('renders explicit normal, warning, and exceeded statuses', async () => {
    fetchBudgetsMock.mockResolvedValueOnce(
      buildOverview([
        buildBudget({
          id: 'budget-normal',
          categoryId: 'category-normal',
          categoryName: 'Normal',
          amount: '100.00',
          spentThisMonth: '79.00',
          remaining: '21.00',
          usageRatio: 0.79,
        }),
        buildBudget({
          id: 'budget-warning',
          categoryId: 'category-warning',
          categoryName: 'Warning',
          amount: '100.00',
          spentThisMonth: '80.00',
          remaining: '20.00',
          usageRatio: 0.8,
        }),
        buildBudget({
          id: 'budget-exceeded',
          categoryId: 'category-exceeded',
          categoryName: 'Exceeded',
          amount: '100.00',
          spentThisMonth: '105.00',
          remaining: '-5.00',
          usageRatio: 1.05,
        }),
      ]),
    );

    render(<BudgetPage />);

    await waitFor(() => {
      expect(fetchBudgetsMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('NORMAL')).toBeTruthy();
    expect(screen.getByText('WARNING')).toBeTruthy();
    expect(screen.getByText('EXCEEDED')).toBeTruthy();
  });

  it('disables duplicate interaction while delete is in flight', async () => {
    const user = userEvent.setup();
    const deferredDelete = createDeferred<ApiBudget>();

    fetchBudgetsMock
      .mockResolvedValueOnce(
        buildOverview([
          buildBudget({
            id: 'budget-bills',
            categoryId: categoryBills.id,
            categoryName: categoryBills.name,
            amount: '100.00',
            spentThisMonth: '45.00',
            remaining: '55.00',
            usageRatio: 0.45,
          }),
        ]),
      )
      .mockResolvedValueOnce(buildOverview([]));

    deleteBudgetMock.mockReturnValueOnce(deferredDelete.promise);

    render(<BudgetPage />);

    await waitFor(() => {
      expect(fetchBudgetsMock).toHaveBeenCalledTimes(1);
    });

    await user.click(within(getBudgetCard('Bills')).getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete budget' }));

    await waitFor(() => {
      expect(deleteBudgetMock).toHaveBeenCalledTimes(1);
    });

    const deleteDialog = screen.getByRole('dialog');
    const deletingButton = within(deleteDialog).getByRole('button', {
      name: 'Deleting...',
    }) as HTMLButtonElement;
    expect(deletingButton.disabled).toBe(true);

    await user.click(deletingButton);
    expect(deleteBudgetMock).toHaveBeenCalledTimes(1);

    deferredDelete.resolve(
      buildBudget({
        id: 'budget-bills',
        categoryId: categoryBills.id,
        categoryName: categoryBills.name,
        amount: '100.00',
        spentThisMonth: '45.00',
        remaining: '55.00',
        usageRatio: 0.45,
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeTruthy();
    });
  });

  it('renders empty state CTA and allows opening create modal from it', async () => {
    const user = userEvent.setup();

    fetchBudgetsMock.mockResolvedValueOnce(buildOverview([]));

    render(<BudgetPage />);

    await waitFor(() => {
      expect(fetchBudgetsMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('No budgets yet')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Create budget' }));
    expect(screen.getByRole('heading', { name: 'New Budget' })).toBeTruthy();
  });

  it('renders error state and retries loading budgets', async () => {
    const user = userEvent.setup();

    fetchBudgetsMock
      .mockRejectedValueOnce(new Error('Budget endpoint unavailable'))
      .mockRejectedValueOnce(new Error('Budget endpoint unavailable'));

    render(<BudgetPage />);

    await waitFor(() => {
      expect(screen.getByText('Budget endpoint unavailable')).toBeTruthy();
    });

    fetchBudgetsMock.mockReset();
    fetchBudgetsMock.mockResolvedValue(
      buildOverview([
        buildBudget({
          id: 'budget-bills',
          categoryId: categoryBills.id,
          categoryName: categoryBills.name,
          amount: '100.00',
          spentThisMonth: '45.00',
          remaining: '55.00',
          usageRatio: 0.45,
        }),
      ]),
    );

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Bills' })).toBeTruthy();
    });
  });
});
