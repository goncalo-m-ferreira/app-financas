import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  fetchCurrentUser,
  loginWithGoogle,
  loginUser,
  logoutSession,
  registerUser,
} from '../services/api';
import type { ApiUser, AuthPayload, LoginInput, RegisterInput } from '../types/finance';

type AuthContextValue = {
  token: string | null;
  user: ApiUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isInitializing: boolean;
  login: (payload: LoginInput) => Promise<void>;
  loginWithGoogleCredential: (credential: string) => Promise<void>;
  register: (payload: RegisterInput) => Promise<void>;
  setAuthenticatedUser: (user: ApiUser) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const COOKIE_SESSION_MARKER = 'cookie-session';

export function AuthProvider({ children }: PropsWithChildren): JSX.Element {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    async function initializeAuth(): Promise<void> {
      try {
        const me = await fetchCurrentUser(undefined, controller.signal);

        if (!isMounted) {
          return;
        }

        setToken(COOKIE_SESSION_MARKER);
        setUser(me);
      } catch {
        if (!isMounted) {
          return;
        }

        setToken(null);
        setUser(null);
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    }

    initializeAuth();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const applyAuthenticatedSession = useCallback((auth: AuthPayload) => {
    setToken(COOKIE_SESSION_MARKER);
    setUser(auth.user);
  }, []);

  const login = useCallback(async (payload: LoginInput) => {
    const auth = await loginUser(payload);
    applyAuthenticatedSession(auth);
  }, [applyAuthenticatedSession]);

  const loginWithGoogleCredential = useCallback(
    async (credential: string) => {
      const auth = await loginWithGoogle({ credential });
      applyAuthenticatedSession(auth);
    },
    [applyAuthenticatedSession],
  );

  const register = useCallback(async (payload: RegisterInput) => {
    const auth = await registerUser(payload);
    applyAuthenticatedSession(auth);
  }, [applyAuthenticatedSession]);

  const setAuthenticatedUser = useCallback((nextUser: ApiUser) => {
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    void logoutSession(token ?? undefined).catch(() => {
      // Ignore backend logout failures and clear local session state regardless.
    });
    setToken(null);
    setUser(null);
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      isAdmin: user?.role === 'ADMIN',
      isInitializing,
      login,
      loginWithGoogleCredential,
      register,
      setAuthenticatedUser,
      logout,
    }),
    [isInitializing, login, loginWithGoogleCredential, logout, register, setAuthenticatedUser, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }

  return context;
}
