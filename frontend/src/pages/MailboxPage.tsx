import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/dashboard/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import {
  ApiClientError,
  fetchNotifications,
  markNotificationAsRead,
} from '../services/api';
import type { ApiNotification } from '../types/finance';

export function MailboxPage(): JSX.Element {
  const { token, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { markOneAsReadLocally, refreshUnreadCount } = useNotifications();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState<number>(0);

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

        const response = await fetchNotifications(tokenValue, controller.signal);

        if (!isMounted) {
          return;
        }

        setNotifications(
          [...response].sort(
            (left, right) =>
              new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
          ),
        );
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

    loadNotifications();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [refreshTick, token]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications],
  );

  async function handleSelectNotification(notification: ApiNotification): Promise<void> {
    const nextExpandedId = expandedId === notification.id ? null : notification.id;
    setExpandedId(nextExpandedId);

    if (!token || notification.isRead) {
      return;
    }

    try {
      const updatedNotification = await markNotificationAsRead(token, notification.id);

      setNotifications((current) =>
        current.map((item) =>
          item.id === updatedNotification.id
            ? {
                ...item,
                isRead: updatedNotification.isRead,
              }
            : item,
        ),
      );

      markOneAsReadLocally();
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Failed to mark notification as read.');
      }
    }
  }

  function handleLogout(): void {
    logout();
    navigate('/login', { replace: true });
  }

  function handleRefresh(): void {
    setRefreshTick((current) => current + 1);
    void refreshUnreadCount();
  }

  return (
    <div className="min-h-screen bg-[#eef0f1] p-3 dark:bg-[#020617] lg:p-5">
      <div className="mx-auto max-w-[1380px] overflow-hidden rounded-[28px] border border-slate-200 bg-[#f6f7f8] shadow-[0_18px_45px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-[#0b1220] dark:shadow-[0_20px_55px_rgba(2,6,23,0.85)]">
        <div className="lg:grid lg:grid-cols-[240px_1fr]">
          <Sidebar isDarkMode={isDarkMode} onToggleTheme={toggleTheme} activeItem="mailbox" />

          <main className="space-y-4 p-4 lg:p-6" aria-live="polite">
            <header className="rounded-xl bg-slate-50 px-6 py-6 dark:bg-slate-950/50">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                    Mailbox
                  </h1>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Alerts and updates from your MoneyWise account.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    Unread: {unreadCount}
                  </span>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </header>

            {errorMessage ? (
              <section className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                <p>{errorMessage}</p>
              </section>
            ) : null}

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              {loading ? (
                <div className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
                  Loading mailbox messages...
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
                  No notifications found.
                </div>
              ) : (
                <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                  {notifications.map((notification) => {
                    const isExpanded = expandedId === notification.id;
                    const isUnread = !notification.isRead;

                    return (
                      <li key={notification.id}>
                        <button
                          type="button"
                          onClick={() => void handleSelectNotification(notification)}
                          className={[
                            'w-full px-6 py-4 text-left transition',
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
                                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
                                ].join(' ')}
                              >
                                {notification.type}
                              </span>
                            </div>
                          </div>

                          {isExpanded ? (
                            <div className="mt-3 border-t border-slate-200 pt-3 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-300">
                              {notification.message}
                            </div>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
