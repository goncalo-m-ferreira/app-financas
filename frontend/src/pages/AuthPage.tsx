import { useMemo, useState, type FormEvent } from 'react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { SUPPORTED_CURRENCIES } from '../constants/currencies';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../services/api';

type AuthMode = 'login' | 'register';

type AuthPageProps = {
  mode: AuthMode;
};

export function AuthPage({ mode }: AuthPageProps): JSX.Element {
  const { isAuthenticated, isInitializing, login, loginWithGoogleCredential, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [defaultCurrency, setDefaultCurrency] = useState<string>('EUR');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isRegisterMode = mode === 'register';
  const pageTitle = isRegisterMode ? 'Create Account' : 'Sign In';
  const submitLabel = isRegisterMode ? 'Sign Up' : 'Sign In';
  const alternateLabel = isRegisterMode ? 'Already have an account?' : "Don't have an account?";
  const alternateRoute = isRegisterMode ? '/login' : '/register';
  const alternateAction = isRegisterMode ? 'Sign In' : 'Sign Up';

  const redirectPath = useMemo(() => {
    const state = location.state as { from?: { pathname?: string } } | null;
    return state?.from?.pathname ?? '/';
  }, [location.state]);

  if (!isInitializing && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (isRegisterMode) {
        await register({
          name: name.trim(),
          email: email.trim(),
          password,
          defaultCurrency: defaultCurrency.trim().toUpperCase(),
        });
      } else {
        await login({
          email: email.trim(),
          password,
        });
      }

      navigate(redirectPath, { replace: true });
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Unexpected authentication error.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSuccess(response: CredentialResponse): Promise<void> {
    if (!response.credential) {
      setErrorMessage('Invalid Google credential. Please try again.');
      return;
    }

    setErrorMessage(null);
    setIsGoogleSubmitting(true);

    try {
      await loginWithGoogleCredential(response.credential);
      navigate(redirectPath, { replace: true });
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Unexpected Google sign-in error.');
      }
    } finally {
      setIsGoogleSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10 dark:bg-slate-950">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{pageTitle}</h1>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {isRegisterMode ? (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={2}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-slate-500"
              />
            </label>
          ) : null}

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-slate-500"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-slate-500"
            />
          </label>

          {isRegisterMode ? (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Default Currency
              </span>
              <select
                value={defaultCurrency}
                onChange={(event) => setDefaultCurrency(event.target.value)}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-slate-500"
              >
                {SUPPORTED_CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {errorMessage ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Processing...' : submitLabel}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">OR</span>
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        </div>

        <div className="flex min-h-[40px] justify-center">
          {isGoogleSubmitting ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">Processing Google sign-in...</p>
          ) : (
            <GoogleLogin
              onSuccess={(credentialResponse) => {
                void handleGoogleSuccess(credentialResponse);
              }}
              onError={() => {
                setErrorMessage('Google sign-in failed. Please try again.');
              }}
              text={isRegisterMode ? 'signup_with' : 'signin_with'}
            />
          )}
        </div>

        <p className="mt-5 text-sm text-slate-600 dark:text-slate-300">
          {alternateLabel}{' '}
          <Link
            to={alternateRoute}
            className="font-semibold text-slate-900 underline-offset-4 hover:underline dark:text-white"
          >
            {alternateAction}
          </Link>
        </p>
      </section>
    </main>
  );
}

export function LoginPage(): JSX.Element {
  return <AuthPage mode="login" />;
}

export function RegisterPage(): JSX.Element {
  return <AuthPage mode="register" />;
}
