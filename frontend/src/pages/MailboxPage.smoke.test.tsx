import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import {
  fetchNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../services/api';
import type {
  ApiNotification,
  NotificationsListResponse,
  NotificationsMarkAllAsReadResponse,
} from '../types/finance';
import { MailboxPage } from './MailboxPage';

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

vi.mock('../context/NotificationContext', () => ({
  useNotifications: vi.fn(),
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
  fetchNotifications: vi.fn(),
  markNotificationAsRead: vi.fn(),
  markAllNotificationsAsRead: vi.fn(),
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

function buildNotification(overrides: Partial<ApiNotification> = {}): ApiNotification {
  return {
    id: 'notification-1',
    userId: 'user-1',
    title: 'Report Ready',
    message: 'Your report is ready to download.',
    targetPath: '/reports',
    type: 'REPORT',
    isRead: false,
    createdAt: '2026-03-08T10:00:00.000Z',
    ...overrides,
  };
}

function buildListResponse(
  items: ApiNotification[],
  nextCursor: string | null = null,
): NotificationsListResponse {
  return {
    items,
    nextCursor,
  };
}

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseNotifications = vi.mocked(useNotifications);
const fetchNotificationsMock = vi.mocked(fetchNotifications);
const markNotificationAsReadMock = vi.mocked(markNotificationAsRead);
const markAllNotificationsAsReadMock = vi.mocked(markAllNotificationsAsRead);

const refreshUnreadCountMock = vi.fn().mockResolvedValue(undefined);
const markOneAsReadLocallyMock = vi.fn();

function renderMailbox(): void {
  render(
    <MemoryRouter>
      <MailboxPage />
    </MemoryRouter>,
  );
}

describe('MailboxPage smoke', () => {
  beforeEach(() => {
    refreshUnreadCountMock.mockReset();
    refreshUnreadCountMock.mockResolvedValue(undefined);
    markOneAsReadLocallyMock.mockReset();

    mockedUseAuth.mockReturnValue({
      token: 'token-mailbox',
      user: {
        id: 'user-1',
        name: 'Mailbox User',
        email: 'mailbox.user@app.local',
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

    mockedUseNotifications.mockReturnValue({
      unreadCount: 2,
      refreshUnreadCount: refreshUnreadCountMock,
      markOneAsReadLocally: markOneAsReadLocallyMock,
    });

    fetchNotificationsMock.mockResolvedValue(
      buildListResponse([
        buildNotification(),
        buildNotification({
          id: 'notification-2',
          title: 'Budget Alert',
          message: 'You are near your monthly budget limit.',
          type: 'BUDGET',
          targetPath: '/budgets',
          isRead: true,
        }),
      ]),
    );

    markNotificationAsReadMock.mockResolvedValue(
      buildNotification({
        isRead: true,
      }),
    );

    markAllNotificationsAsReadMock.mockResolvedValue({
      updatedCount: 2,
    } satisfies NotificationsMarkAllAsReadResponse);
  });

  it('renders mailbox and loads notifications', async () => {
    renderMailbox();

    await waitFor(() => {
      expect(fetchNotificationsMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('heading', { name: 'Mailbox' })).toBeTruthy();
    expect(screen.getByText('Report Ready')).toBeTruthy();
    expect(screen.getByText('Budget Alert')).toBeTruthy();
  });

  it('applies read and type filters through API query params', async () => {
    const user = userEvent.setup();

    renderMailbox();

    await waitFor(() => {
      expect(fetchNotificationsMock).toHaveBeenCalledTimes(1);
    });

    await user.selectOptions(screen.getByLabelText('Read state'), 'UNREAD');

    await waitFor(() => {
      expect(fetchNotificationsMock).toHaveBeenCalledTimes(2);
    });

    expect(fetchNotificationsMock.mock.calls[1]?.[1]).toMatchObject({
      isRead: false,
      type: undefined,
    });

    await user.selectOptions(screen.getByLabelText('Notification type'), 'REPORT');

    await waitFor(() => {
      expect(fetchNotificationsMock).toHaveBeenCalledTimes(3);
    });

    expect(fetchNotificationsMock.mock.calls[2]?.[1]).toMatchObject({
      isRead: false,
      type: 'REPORT',
    });
  });

  it('marks all notifications as read and refreshes unread counter', async () => {
    const user = userEvent.setup();

    renderMailbox();

    await waitFor(() => {
      expect(fetchNotificationsMock).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('button', { name: 'Mark All As Read' }));

    await waitFor(() => {
      expect(markAllNotificationsAsReadMock).toHaveBeenCalledTimes(1);
    });

    expect(refreshUnreadCountMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('All notifications marked as read.')).toBeTruthy();
  });

  it('shows actionable CTA when notification has targetPath', async () => {
    const user = userEvent.setup();

    renderMailbox();

    await waitFor(() => {
      expect(fetchNotificationsMock).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('button', { name: /Report Ready/i }));

    const openLink = await screen.findByRole('link', { name: 'Open' });
    expect(openLink.getAttribute('href')).toBe('/reports');
  });

  it('renders loading, error with retry, and empty state', async () => {
    const user = userEvent.setup();
    const deferred = createDeferred<NotificationsListResponse>();

    fetchNotificationsMock.mockReset();
    fetchNotificationsMock
      .mockReturnValueOnce(deferred.promise)
      .mockRejectedValueOnce(new Error('Mailbox offline'))
      .mockResolvedValueOnce(buildListResponse([]));

    renderMailbox();

    expect(screen.getByText('Loading mailbox messages...')).toBeTruthy();

    deferred.resolve(buildListResponse([buildNotification()]));

    await waitFor(() => {
      expect(fetchNotificationsMock).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(fetchNotificationsMock).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByText('Mailbox offline')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(fetchNotificationsMock).toHaveBeenCalledTimes(3);
    });

    expect(screen.getByText('No notifications found.')).toBeTruthy();
  });
});
