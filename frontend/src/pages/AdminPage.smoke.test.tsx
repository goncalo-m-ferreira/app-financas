import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../context/AuthContext';
import { fetchAdminOverview, fetchAdminRecurringOperations } from '../services/api';
import type { AdminOverviewResponse, AdminRecurringOperationsResponse } from '../types/finance';
import { AdminPage } from './AdminPage';

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
  fetchAdminOverview: vi.fn(),
  fetchAdminRecurringOperations: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const fetchAdminOverviewMock = vi.mocked(fetchAdminOverview);
const fetchAdminRecurringOperationsMock = vi.mocked(fetchAdminRecurringOperations);

const overviewFixture: AdminOverviewResponse = {
  summary: {
    totalUsers: 3,
  },
  users: [
    {
      id: 'user-overview-1',
      name: 'Overview User',
      email: 'overview.user@app.local',
      role: 'USER',
      createdAt: '2026-03-01T10:00:00.000Z',
    },
  ],
};

const operationsFixture: AdminRecurringOperationsResponse = {
  summary: {
    failedExecutions: 1,
    pausedRules: 1,
    affectedUsers: 1,
  },
  items: [
    {
      issueType: 'FAILED_EXECUTION',
      occurredAt: '2026-03-07T10:00:00.000Z',
      user: {
        id: 'ops-user-1',
        name: 'Ops User',
        email: 'ops.user@app.local',
      },
      rule: {
        id: 'ops-rule-1',
        description: 'Ops rent',
        type: 'EXPENSE',
        amount: '99.00',
        status: 'ACTIVE',
        pausedReason: null,
        frequency: 'MONTHLY',
        timezone: 'Europe/Lisbon',
        wallet: {
          id: 'ops-wallet-1',
          name: 'Ops Wallet',
          color: '#0ea5e9',
        },
        category: {
          id: 'ops-category-1',
          name: 'Bills',
          color: '#111827',
          icon: 'home',
        },
      },
      execution: {
        id: 'ops-exec-1',
        status: 'FAILED',
        scheduledFor: '2026-03-07T09:00:00.000Z',
        attemptedAt: '2026-03-07T09:01:00.000Z',
        errorType: 'TRANSIENT',
        errorMessage: 'Timeout',
      },
    },
  ],
};

describe('AdminPage recurring operations smoke', () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      token: 'token-admin',
      user: {
        id: 'admin-1',
        name: 'Admin User',
        email: 'admin@app.local',
        role: 'ADMIN',
        defaultCurrency: 'EUR',
        avatarUrl: null,
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
      isAuthenticated: true,
      isAdmin: true,
      isInitializing: false,
      login: vi.fn(),
      loginWithGoogleCredential: vi.fn(),
      register: vi.fn(),
      setAuthenticatedUser: vi.fn(),
      logout: vi.fn(),
    });

    fetchAdminOverviewMock.mockResolvedValue(overviewFixture);
    fetchAdminRecurringOperationsMock.mockResolvedValue(operationsFixture);
  });

  it('renders recurring operations section', async () => {
    render(<AdminPage />);

    await waitFor(() => {
      expect(fetchAdminOverviewMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(fetchAdminRecurringOperationsMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('heading', { name: 'Recurring Operations' })).toBeTruthy();
    expect(screen.getByText('Ops User')).toBeTruthy();
  });

  it('keeps recurring operations visible when overview fails', async () => {
    fetchAdminOverviewMock.mockRejectedValueOnce(new Error('Overview offline'));
    fetchAdminRecurringOperationsMock.mockResolvedValueOnce(operationsFixture);

    render(<AdminPage />);

    await waitFor(() => {
      expect(fetchAdminRecurringOperationsMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Retry overview')).toBeTruthy();
    expect(screen.getByText('Ops User')).toBeTruthy();
  });

  it('keeps overview visible when recurring operations fail', async () => {
    fetchAdminOverviewMock.mockResolvedValueOnce(overviewFixture);
    fetchAdminRecurringOperationsMock.mockRejectedValueOnce(new Error('Operations offline'));

    render(<AdminPage />);

    await waitFor(() => {
      expect(fetchAdminOverviewMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('overview.user@app.local')).toBeTruthy();
    expect(screen.getByText('Retry recurring operations')).toBeTruthy();
  });

  it('reloads recurring operations on issue filter change without reloading overview', async () => {
    const user = userEvent.setup();

    render(<AdminPage />);

    await waitFor(() => {
      expect(fetchAdminOverviewMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(fetchAdminRecurringOperationsMock).toHaveBeenCalledTimes(1);
    });

    await user.selectOptions(screen.getByLabelText('Issue'), 'PAUSED_RULE');

    await waitFor(() => {
      expect(fetchAdminRecurringOperationsMock).toHaveBeenCalledTimes(2);
    });
    expect(fetchAdminOverviewMock).toHaveBeenCalledTimes(1);
  });

  it('reloads both sections when global refresh is used', async () => {
    const user = userEvent.setup();

    render(<AdminPage />);

    await waitFor(() => {
      expect(fetchAdminOverviewMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(fetchAdminRecurringOperationsMock).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(fetchAdminOverviewMock).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(fetchAdminRecurringOperationsMock).toHaveBeenCalledTimes(2);
    });
  });
});
