import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../context/AuthContext';
import { useDateFilter } from '../context/DateFilterContext';
import { useSearch } from '../context/SearchContext';
import { useTheme } from '../context/ThemeContext';
import {
  createTransaction,
  deleteTransaction,
  fetchDashboardData,
  importTransactionsCsv,
  updateTransaction,
} from '../services/api';
import type {
  DashboardApiData,
  ImportTransactionsResult,
} from '../types/finance';
import { DashboardPage } from './DashboardPage';

vi.mock('../components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

vi.mock('../components/dashboard/ImportCsvModal', () => ({
  ImportCsvModal: ({
    open,
    onClose,
    onSubmit,
  }: {
    open: boolean;
    onClose: () => void;
    onSubmit: (payload: { walletId: string; file: File }) => Promise<void>;
  }) =>
    open ? (
      <div role="dialog" aria-label="Import CSV">
        <button
          type="button"
          onClick={() => {
            void onSubmit({
              walletId: 'wallet-1',
              file: new File(['date,description,amount'], 'transactions.csv', { type: 'text/csv' }),
            });
          }}
        >
          Confirm import
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../context/DateFilterContext', () => ({
  useDateFilter: vi.fn(),
}));

vi.mock('../context/SearchContext', () => ({
  useSearch: vi.fn(),
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: vi.fn(),
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
  fetchDashboardData: vi.fn(),
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  importTransactionsCsv: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseDateFilter = vi.mocked(useDateFilter);
const mockedUseSearch = vi.mocked(useSearch);
const mockedUseTheme = vi.mocked(useTheme);
const fetchDashboardDataMock = vi.mocked(fetchDashboardData);
const createTransactionMock = vi.mocked(createTransaction);
const updateTransactionMock = vi.mocked(updateTransaction);
const deleteTransactionMock = vi.mocked(deleteTransaction);
const importTransactionsCsvMock = vi.mocked(importTransactionsCsv);

function buildDashboardData(): DashboardApiData {
  return {
    user: {
      id: 'user-1',
      name: 'Dashboard User',
      email: 'dashboard.user@app.local',
      role: 'USER',
      defaultCurrency: 'EUR',
      avatarUrl: null,
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    },
    categories: [
      {
        id: 'category-bills',
        userId: 'user-1',
        name: 'Bills',
        color: '#ef4444',
        icon: null,
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
      {
        id: 'category-food',
        userId: 'user-1',
        name: 'Food',
        color: '#22c55e',
        icon: null,
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
    ],
    wallets: [
      {
        id: 'wallet-1',
        userId: 'user-1',
        name: 'Main Wallet',
        balance: '450.00',
        color: '#0ea5e9',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
    ],
    transactions: [
      {
        id: 'tx-expense-1',
        userId: 'user-1',
        categoryId: 'category-bills',
        walletId: 'wallet-1',
        type: 'EXPENSE',
        amount: '200.00',
        description: 'Rent',
        transactionDate: '2026-03-05T09:00:00.000Z',
        createdAt: '2026-03-05T09:00:00.000Z',
        updatedAt: '2026-03-05T09:00:00.000Z',
        category: {
          id: 'category-bills',
          name: 'Bills',
          color: '#ef4444',
          icon: null,
        },
        wallet: {
          id: 'wallet-1',
          name: 'Main Wallet',
          color: '#0ea5e9',
        },
      },
      {
        id: 'tx-expense-2',
        userId: 'user-1',
        categoryId: 'category-food',
        walletId: 'wallet-1',
        type: 'EXPENSE',
        amount: '50.00',
        description: 'Groceries',
        transactionDate: '2026-03-07T10:00:00.000Z',
        createdAt: '2026-03-07T10:00:00.000Z',
        updatedAt: '2026-03-07T10:00:00.000Z',
        category: {
          id: 'category-food',
          name: 'Food',
          color: '#22c55e',
          icon: null,
        },
        wallet: {
          id: 'wallet-1',
          name: 'Main Wallet',
          color: '#0ea5e9',
        },
      },
      {
        id: 'tx-income-1',
        userId: 'user-1',
        categoryId: null,
        walletId: 'wallet-1',
        type: 'INCOME',
        amount: '500.00',
        description: 'Salary',
        transactionDate: '2026-03-10T09:00:00.000Z',
        createdAt: '2026-03-10T09:00:00.000Z',
        updatedAt: '2026-03-10T09:00:00.000Z',
        category: null,
        wallet: {
          id: 'wallet-1',
          name: 'Main Wallet',
          color: '#0ea5e9',
        },
      },
    ],
    balance: '250.00',
  };
}

describe('DashboardPage smoke', () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      token: 'token-dashboard',
      user: {
        id: 'user-1',
        name: 'Dashboard User',
        email: 'dashboard.user@app.local',
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

    mockedUseSearch.mockReturnValue({
      searchQuery: '',
      setSearchQuery: vi.fn(),
    });

    mockedUseTheme.mockReturnValue({
      theme: 'dark',
      isDarkMode: true,
      toggleTheme: vi.fn(),
    });

    fetchDashboardDataMock.mockResolvedValue(buildDashboardData());
    createTransactionMock.mockRejectedValue(new Error('Not used in this test.'));
    updateTransactionMock.mockRejectedValue(new Error('Not used in this test.'));
    deleteTransactionMock.mockRejectedValue(new Error('Not used in this test.'));
  });

  it('renders polished dashboard header and category share rows', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(fetchDashboardDataMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Financial Overview')).toBeTruthy();
    expect(
      screen.getByText('Your balance, category spending, and recent activity for the selected month.'),
    ).toBeTruthy();

    expect(screen.getByRole('button', { name: 'Add Transaction' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Import CSV' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Notifications \(Coming Soon\)/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Open quick actions \(Coming Soon\)/i })).toBeNull();

    expect(screen.getByText('Bills')).toBeTruthy();
    expect(screen.getByText('Food')).toBeTruthy();
    expect(screen.getByText(/80.0%/)).toBeTruthy();
    expect(screen.getByText(/20.0%/)).toBeTruthy();
  });

  it('shows success toast after CSV import and does not use browser alert', async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const importResult: ImportTransactionsResult = {
      importedCount: 2,
      walletId: 'wallet-1',
      netAmount: '-250.00',
    };

    fetchDashboardDataMock
      .mockResolvedValueOnce(buildDashboardData())
      .mockResolvedValueOnce(buildDashboardData());
    importTransactionsCsvMock.mockResolvedValueOnce(importResult);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(fetchDashboardDataMock).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('button', { name: 'Import CSV' }));
    await user.click(screen.getByRole('button', { name: 'Confirm import' }));

    await waitFor(() => {
      expect(importTransactionsCsvMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(fetchDashboardDataMock).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByText('2 transactions imported successfully.')).toBeTruthy();
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
