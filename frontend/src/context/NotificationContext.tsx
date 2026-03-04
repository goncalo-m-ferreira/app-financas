import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { fetchNotifications } from '../services/api';
import { useAuth } from './AuthContext';

type NotificationContextValue = {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  markOneAsReadLocally: () => void;
};

const NOTIFICATIONS_POLLING_INTERVAL_MS = 10000;

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: PropsWithChildren): JSX.Element {
  const { token } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!token) {
      setUnreadCount(0);
      return;
    }

    const notifications = await fetchNotifications(token);
    setUnreadCount(notifications.filter((notification) => !notification.isRead).length);
  }, [token]);

  const markOneAsReadLocally = useCallback(() => {
    setUnreadCount((current) => Math.max(0, current - 1));
  }, []);

  useEffect(() => {
    if (!token) {
      setUnreadCount(0);
      return;
    }

    const controller = new AbortController();

    fetchNotifications(token, controller.signal)
      .then((notifications) => {
        setUnreadCount(notifications.filter((notification) => !notification.isRead).length);
      })
      .catch(() => {
        setUnreadCount(0);
      });

    return () => {
      controller.abort();
    };
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshUnreadCount().catch(() => {
        // The badge falls back to the previous value if polling fails.
      });
    }, NOTIFICATIONS_POLLING_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshUnreadCount, token]);

  const value = useMemo<NotificationContextValue>(
    () => ({
      unreadCount,
      refreshUnreadCount,
      markOneAsReadLocally,
    }),
    [markOneAsReadLocally, refreshUnreadCount, unreadCount],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error('useNotifications must be used inside NotificationProvider.');
  }

  return context;
}
