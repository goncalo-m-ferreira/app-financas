import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ActionButton } from '../components/design/ActionButton';
import { StatusBanner } from '../components/design/StatusBanner';
import { SurfacePanel } from '../components/design/SurfacePanel';
import { AppShell } from '../components/layout/AppShell';
import { PremiumPageHeader } from '../components/layout/PremiumPageHeader';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import {
  ApiClientError,
  fetchNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../services/api';
import type { ApiNotification, NotificationsTypeFilter } from '../types/finance';

type MailboxReadFilter = 'ALL' | 'UNREAD' | 'READ';
type MailboxTypeFilter = 'ALL' | NotificationsTypeFilter;

const SUCCESS_TOAST_TTL_MS = 2600;
const NOTIFICATIONS_PAGE_SIZE = 50;

function resolveReadFilter(filter: MailboxReadFilter): boolean | undefined {
  if (filter === 'UNREAD') {
    return false;
  }

  if (filter === 'READ') {
    return true;
  }

  return undefined;
}

function resolveTypeFilter(filter: MailboxTypeFilter): NotificationsTypeFilter | undefined {
  return filter === 'ALL' ? undefined : filter;
}

export function MailboxPage(): JSX.Element {
  const { token } = useAuth();
  const { unreadCount, markOneAsReadLocally, refreshUnreadCount } = useNotifications();
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [isMarkingAllAsRead, setIsMarkingAllAsRead] = useState<boolean>(false);
  const [markingNotificationIds, setMarkingNotificationIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState<number>(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [readFilter, setReadFilter] = useState<MailboxReadFilter>('ALL');
  const [typeFilter, setTypeFilter] = useState<MailboxTypeFilter>('ALL');

  const readFilterQueryValue = useMemo(() => resolveReadFilter(readFilter), [readFilter]);
  const typeFilterQueryValue = useMemo(() => resolveTypeFilter(typeFilter), [typeFilter]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSuccessMessage(null);
    }, SUCCESS_TOAST_TTL_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [successMessage]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const tokenValue = token;
    const controller = new AbortController();
    let isMounted = true;

    async function loadNotifications(): Promise<void> {
      try {
        setLoading(true);
        setErrorMessage(null);

        const response = await fetchNotifications(
          tokenValue,
          {
            isRead: readFilterQueryValue,
            type: typeFilterQueryValue,
            take: NOTIFICATIONS_PAGE_SIZE,
          },
          controller.signal,
        );

        if (!isMounted) {
          return;
        }

        setNotifications(response.items);
        setNextCursor(response.nextCursor);
        setExpandedId(null);
      } catch (error) {
        if (!isMounted || controller.signal.aborted) {
          return;
        }

        if (error instanceof ApiClientError) {
          setErrorMessage(error.message);
          return;
        }

        if (error instanceof Error) {
          setErrorMessage(error.message);
          return;
        }

        setErrorMessage('Unexpected error while loading mailbox messages.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadNotifications();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [readFilterQueryValue, refreshTick, token, typeFilterQueryValue]);

  async function handleSelectNotification(notification: ApiNotification): Promise<void> {
    const nextExpandedId = expandedId === notification.id ? null : notification.id;
    setExpandedId(nextExpandedId);

    if (!token || notification.isRead || isMarkingAllAsRead) {
      return;
    }

    if (markingNotificationIds.includes(notification.id)) {
      return;
    }

    setMarkingNotificationIds((current) => [...current, notification.id]);

    try {
      const updatedNotification = await markNotificationAsRead(token, notification.id);

      setNotifications((current) => {
        return current.flatMap((item) => {
          if (item.id !== updatedNotification.id) {
            return [item];
          }

          const nextItem = {
            ...item,
            isRead: updatedNotification.isRead,
          };

          if (readFilter === 'UNREAD' && nextItem.isRead) {
            return [];
          }

          return [nextItem];
        });
      });

      markOneAsReadLocally();
      void refreshUnreadCount();
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Failed to mark notification as read.');
      }
    } finally {
      setMarkingNotificationIds((current) => current.filter((id) => id !== notification.id));
    }
  }

  async function handleMarkAllAsRead(): Promise<void> {
    if (!token || isMarkingAllAsRead || unreadCount <= 0) {
      return;
    }

    setErrorMessage(null);
    setIsMarkingAllAsRead(true);

    try {
      const result = await markAllNotificationsAsRead(token);

      setNotifications((current) => {
        if (readFilter === 'UNREAD') {
          return [];
        }

        return current.map((notification) => ({
          ...notification,
          isRead: true,
        }));
      });
      setExpandedId(null);

      await refreshUnreadCount();
      setSuccessMessage(
        result.updatedCount > 0
          ? 'All notifications marked as read.'
          : 'No unread notifications to update.',
      );
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Failed to mark all notifications as read.');
      }
    } finally {
      setIsMarkingAllAsRead(false);
    }
  }

  async function handleLoadMore(): Promise<void> {
    if (!token || !nextCursor || loading || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const response = await fetchNotifications(token, {
        isRead: readFilterQueryValue,
        type: typeFilterQueryValue,
        take: NOTIFICATIONS_PAGE_SIZE,
        cursor: nextCursor,
      });

      setNotifications((current) => {
        const seen = new Set(current.map((notification) => notification.id));
        const nextItems = response.items.filter((notification) => !seen.has(notification.id));
        return [...current, ...nextItems];
      });
      setNextCursor(response.nextCursor);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Failed to load more notifications.');
      }
    } finally {
      setIsLoadingMore(false);
    }
  }

  function handleRefresh(): void {
    setRefreshTick((current) => current + 1);
    void refreshUnreadCount();
  }

  return (
    <>
      <AppShell activeItem="mailbox">
        <PremiumPageHeader
          title="Mailbox"
          description="Alerts and updates from your MoneyWise account."
          actions={
            <>
              <label className="rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-3 py-2 text-xs text-[color:var(--text-muted)] shadow-[0_8px_18px_rgba(16,34,51,0.08)] backdrop-blur-sm">
                <span className="mr-2 font-semibold">Read</span>
                <select
                  aria-label="Read state"
                  value={readFilter}
                  onChange={(event) => setReadFilter(event.target.value as MailboxReadFilter)}
                  disabled={loading || isMarkingAllAsRead}
                  className="ds-focus-ring rounded border border-[color:var(--surface-border)] bg-[color:var(--surface-card-strong)] px-2 py-1 text-xs text-[color:var(--text-main)] dark:bg-[color:var(--surface-card)]"
                >
                  <option value="ALL">All</option>
                  <option value="UNREAD">Unread</option>
                  <option value="READ">Read</option>
                </select>
              </label>

              <label className="rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-3 py-2 text-xs text-[color:var(--text-muted)] shadow-[0_8px_18px_rgba(16,34,51,0.08)] backdrop-blur-sm">
                <span className="mr-2 font-semibold">Type</span>
                <select
                  aria-label="Notification type"
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value as MailboxTypeFilter)}
                  disabled={loading || isMarkingAllAsRead}
                  className="ds-focus-ring rounded border border-[color:var(--surface-border)] bg-[color:var(--surface-card-strong)] px-2 py-1 text-xs text-[color:var(--text-main)] dark:bg-[color:var(--surface-card)]"
                >
                  <option value="ALL">All</option>
                  <option value="BUDGET">Budget</option>
                  <option value="RECURRING">Recurring</option>
                  <option value="REPORT">Report</option>
                  <option value="SYSTEM">System</option>
                </select>
              </label>

              <span className="rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-3 py-2 text-xs font-semibold text-[color:var(--text-muted)] shadow-[0_8px_18px_rgba(16,34,51,0.08)] backdrop-blur-sm">
                Unread: {unreadCount}
              </span>

              <ActionButton
                type="button"
                variant="neutral"
                onClick={() => {
                  void handleMarkAllAsRead();
                }}
                disabled={isMarkingAllAsRead || unreadCount <= 0}
              >
                {isMarkingAllAsRead ? 'Updating...' : 'Mark All As Read'}
              </ActionButton>

              <ActionButton
                type="button"
                variant="neutral"
                onClick={handleRefresh}
                disabled={loading || isMarkingAllAsRead}
              >
                Refresh
              </ActionButton>
            </>
          }
        />

        {errorMessage ? (
          <StatusBanner tone="danger">
            <p>{errorMessage}</p>
            <ActionButton type="button" variant="danger" size="sm" onClick={handleRefresh} className="mt-3">
              Retry
            </ActionButton>
          </StatusBanner>
        ) : null}

        <SurfacePanel as="section" variant="solid" padding="none">
          {loading ? (
            <div className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">Loading mailbox messages...</div>
          ) : notifications.length === 0 ? (
            <div className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">No notifications found.</div>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {notifications.map((notification) => {
                const isExpanded = expandedId === notification.id;
                const isUnread = !notification.isRead;
                const isMarkingThis = markingNotificationIds.includes(notification.id);

                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => {
                        void handleSelectNotification(notification);
                      }}
                      disabled={isMarkingThis || isMarkingAllAsRead}
                      className={[
                        'w-full px-6 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-70',
                        isUnread
                          ? 'bg-slate-100 dark:bg-slate-800/60'
                          : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/40',
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p
                            className={[
                              'truncate text-sm',
                              isUnread
                                ? 'font-semibold text-slate-900 dark:text-slate-100'
                                : 'font-medium text-slate-700 dark:text-slate-200',
                            ].join(' ')}
                          >
                            {notification.title}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                            {notification.message}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            {new Intl.DateTimeFormat('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            }).format(new Date(notification.createdAt))}
                          </p>
                          <span
                            className={[
                              'mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                              notification.type === 'BUDGET'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                : notification.type === 'REPORT'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                  : notification.type === 'RECURRING'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
                            ].join(' ')}
                          >
                            {notification.type}
                          </span>
                        </div>
                      </div>
                    </button>

                    {isExpanded ? (
                      <div className="border-t border-slate-200 px-6 py-3 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-300">
                        <p>{notification.message}</p>

                        {notification.targetPath ? (
                          <Link
                            to={notification.targetPath}
                            className="mt-3 inline-flex rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            Open
                          </Link>
                        ) : null}

                        {isMarkingThis ? (
                          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Marking as read...</p>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {!loading && notifications.length > 0 && nextCursor ? (
            <div className="border-t border-slate-200 px-6 py-4 text-right dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  void handleLoadMore();
                }}
                disabled={isLoadingMore || isMarkingAllAsRead}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {isLoadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          ) : null}
        </SurfacePanel>
      </AppShell>

      {successMessage ? (
        <div
          className="fixed right-4 top-4 z-[60] rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 shadow-lg dark:border-emerald-900/60 dark:bg-emerald-950/80 dark:text-emerald-300"
          role="status"
          aria-live="polite"
        >
          {successMessage}
        </div>
      ) : null}
    </>
  );
}
