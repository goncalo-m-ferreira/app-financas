import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MonthYearSelector } from '../components/common/MonthYearSelector';
import { useAuth } from '../context/AuthContext';
import { useDateFilter } from '../context/DateFilterContext';
import {
  createReport,
  downloadReport,
  fetchReports,
  regenerateReport,
} from '../services/api';
import type { ApiReport } from '../types/finance';
import { ReportsPage } from './ReportsPage';

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

vi.mock('../components/common/MonthYearSelector', () => ({
  MonthYearSelector: vi.fn(() => <div data-testid="month-year-selector">month-selector</div>),
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
  fetchReports: vi.fn(),
  createReport: vi.fn(),
  regenerateReport: vi.fn(),
  downloadReport: vi.fn(),
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

function buildReport(overrides: Partial<ApiReport> = {}): ApiReport {
  return {
    id: 'report-1',
    userId: 'user-1',
    name: 'March 2026 Monthly Report',
    month: 3,
    year: 2026,
    status: 'PENDING',
    fileUrl: null,
    errorMessage: null,
    createdAt: '2026-03-08T12:00:00.000Z',
    updatedAt: '2026-03-08T12:00:00.000Z',
    ...overrides,
  };
}

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseDateFilter = vi.mocked(useDateFilter);
const monthYearSelectorMock = vi.mocked(MonthYearSelector);
const fetchReportsMock = vi.mocked(fetchReports);
const createReportMock = vi.mocked(createReport);
const regenerateReportMock = vi.mocked(regenerateReport);
const downloadReportMock = vi.mocked(downloadReport);

describe('ReportsPage smoke', () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      token: 'token-reports',
      user: {
        id: 'user-1',
        name: 'Reports User',
        email: 'reports.user@app.local',
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

    monthYearSelectorMock.mockImplementation(() => <div data-testid="month-year-selector" />);

    fetchReportsMock.mockResolvedValue([buildReport()]);
    createReportMock.mockResolvedValue(buildReport({ id: 'report-created' }));
    regenerateReportMock.mockResolvedValue(buildReport({ id: 'report-regenerated' }));
    downloadReportMock.mockResolvedValue(new Blob(['pdf-content'], { type: 'application/pdf' }));

    const createObjectUrlMock = vi.fn(() => 'blob:report');
    const revokeObjectUrlMock = vi.fn();

    if (typeof URL.createObjectURL === 'function') {
      vi.spyOn(URL, 'createObjectURL').mockImplementation(createObjectUrlMock);
    } else {
      (URL as { createObjectURL?: (input: Blob) => string }).createObjectURL = createObjectUrlMock;
    }

    if (typeof URL.revokeObjectURL === 'function') {
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revokeObjectUrlMock);
    } else {
      (URL as { revokeObjectURL?: (input: string) => void }).revokeObjectURL = revokeObjectUrlMock;
    }
  });

  it('renders reports structure and uses server-side filters', async () => {
    const user = userEvent.setup();

    render(<ReportsPage />);

    await waitFor(() => {
      expect(fetchReportsMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('heading', { name: 'Reports' })).toBeTruthy();
    expect(screen.getByText('Your Reports')).toBeTruthy();
    expect(screen.getByText('Period')).toBeTruthy();

    expect(fetchReportsMock.mock.calls[0]?.[0]).toBe('token-reports');
    expect(fetchReportsMock.mock.calls[0]?.[1]).toMatchObject({
      status: undefined,
      month: 3,
      year: 2026,
    });

    await user.selectOptions(screen.getByLabelText('Report status filter'), 'FAILED');

    await waitFor(() => {
      expect(fetchReportsMock).toHaveBeenCalledTimes(2);
    });

    expect(fetchReportsMock.mock.calls[1]?.[0]).toBe('token-reports');
    expect(fetchReportsMock.mock.calls[1]?.[1]).toMatchObject({
      status: 'FAILED',
      month: 3,
      year: 2026,
    });
  });

  it('shows failed fallback reason and prevents duplicate regenerate clicks in-flight', async () => {
    const user = userEvent.setup();
    const deferredRegenerate = createDeferred<ApiReport>();

    fetchReportsMock.mockResolvedValueOnce([
      buildReport({
        id: 'report-failed',
        status: 'FAILED',
        errorMessage: null,
      }),
    ]);
    regenerateReportMock.mockReturnValueOnce(deferredRegenerate.promise);

    render(<ReportsPage />);

    expect(
      await screen.findByText('This report failed to generate. Please try regenerate.'),
    ).toBeTruthy();

    const regenerateButton = screen.getByRole('button', { name: 'Regenerate' });
    await user.click(regenerateButton);
    await user.click(regenerateButton);

    expect(regenerateReportMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Regenerating...' })).toBeTruthy();

    deferredRegenerate.resolve(buildReport({ id: 'report-regenerated' }));

    await waitFor(() => {
      expect(fetchReportsMock).toHaveBeenCalledTimes(2);
    });
  });

  it('offers authenticated download action and invokes client download path', async () => {
    const user = userEvent.setup();

    fetchReportsMock.mockResolvedValueOnce([
      buildReport({
        id: 'report-completed',
        status: 'COMPLETED',
        fileUrl: '/reports/report-completed.pdf',
      }),
    ]);

    render(<ReportsPage />);

    const downloadButton = await screen.findByRole('button', { name: 'Download' });
    await user.click(downloadButton);

    expect(downloadReportMock).toHaveBeenCalledWith('token-reports', 'report-completed');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('keeps generate action active with selected month/year payload', async () => {
    const user = userEvent.setup();

    render(<ReportsPage />);

    await waitFor(() => {
      expect(fetchReportsMock).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('button', { name: 'Generate Monthly Report' }));

    expect(createReportMock).toHaveBeenCalledWith('token-reports', {
      month: 3,
      year: 2026,
    });
  });
});
