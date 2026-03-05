import { useEffect, useMemo, useState, type FormEvent } from 'react';
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
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isPasswordVisible, setIsPasswordVisible] = useState<boolean>(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState<boolean>(false);
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

  useEffect(() => {
    setConfirmPassword('');
    setIsPasswordVisible(false);
    setIsConfirmPasswordVisible(false);
    setErrorMessage(null);
  }, [mode]);

  if (!isInitializing && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    if (isRegisterMode && password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      setIsSubmitting(false);
      return;
    }

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
              autoComplete="email"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-slate-500"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Password</span>
            <div className="relative">
              <input
                type={isPasswordVisible ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                required
                minLength={8}
                className="w-full rounded-md border border-slate-300 px-3 py-2 pr-10 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-slate-500"
              />
              <button
                type="button"
                onClick={() => setIsPasswordVisible((current) => !current)}
                aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded p-1 text-slate-500 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60 dark:text-slate-400 dark:hover:text-slate-200"
              >
                {isPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </label>

          {isRegisterMode ? (
            <>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Confirm Password
                </span>
                <div className="relative">
                  <input
                    type={isConfirmPasswordVisible ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 pr-10 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => setIsConfirmPasswordVisible((current) => !current)}
                    aria-label={isConfirmPasswordVisible ? 'Hide confirm password' : 'Show confirm password'}
                    className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded p-1 text-slate-500 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    {isConfirmPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </label>

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
            </>
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

function EyeIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function EyeOffIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 3 21 21M10.6 6.2A9.4 9.4 0 0 1 12 6c6 0 9.5 6 9.5 6a16.9 16.9 0 0 1-3.1 3.9M6.3 8.3A16.8 16.8 0 0 0 2.5 12s3.5 6 9.5 6c1.4 0 2.6-.3 3.7-.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.9 9.9A3 3 0 0 0 14.1 14.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function LoginPage(): JSX.Element {
  return <AuthPage mode="login" />;
}

export function RegisterPage(): JSX.Element {
  return <AuthPage mode="register" />;
}
