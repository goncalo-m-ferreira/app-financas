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
  clearAuthToken,
  fetchCurrentUser,
  getStoredAuthToken,
  loginWithGoogle,
  loginUser,
  registerUser,
  saveAuthToken,
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
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren): JSX.Element {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    async function initializeAuth(): Promise<void> {
      const storedToken = getStoredAuthToken();

      if (!storedToken) {
        if (isMounted) {
          setIsInitializing(false);
        }
        return;
      }

      try {
        const me = await fetchCurrentUser(storedToken, controller.signal);

        if (!isMounted) {
          return;
        }

        setToken(storedToken);
        setUser(me);
      } catch {
        clearAuthToken();
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
    saveAuthToken(auth.token);
    setToken(auth.token);
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

  const logout = useCallback(() => {
    clearAuthToken();
    setToken(null);
    setUser(null);
  }, []);

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
      logout,
    }),
    [isInitializing, login, loginWithGoogleCredential, logout, register, token, user],
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
