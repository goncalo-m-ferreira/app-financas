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
const TOKEN_STORAGE_KEY = 'app_financas_auth_token';

function isJwtLikeToken(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.includes('.');
}

function readStoredToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const stored = window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
  return isJwtLikeToken(stored) ? stored : null;
}

function writeStoredToken(token: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (isJwtLikeToken(token)) {
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    return;
  }

  window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function AuthProvider({ children }: PropsWithChildren): JSX.Element {
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [user, setUser] = useState<ApiUser | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    async function initializeAuth(): Promise<void> {
      const storedToken = readStoredToken();

      try {
        if (storedToken) {
          try {
            const meWithStoredToken = await fetchCurrentUser(storedToken, controller.signal);

            if (!isMounted) {
              return;
            }

            setToken(storedToken);
            setUser(meWithStoredToken);
            return;
          } catch {
            writeStoredToken(null);
          }
        }

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

        writeStoredToken(null);
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
    const nextToken = isJwtLikeToken(auth.token) ? auth.token : COOKIE_SESSION_MARKER;
    writeStoredToken(nextToken);
    setToken(nextToken);
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
    writeStoredToken(null);
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
