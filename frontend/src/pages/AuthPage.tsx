import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ActionButton } from '../components/design/ActionButton';
import { CONTROL_INPUT_CLASS_NAME, FieldControl } from '../components/design/FieldControl';
import { StatusBanner } from '../components/design/StatusBanner';
import { SurfacePanel } from '../components/design/SurfacePanel';
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
  const nameFieldId = useId();
  const emailFieldId = useId();
  const passwordFieldId = useId();
  const confirmPasswordFieldId = useId();
  const currencyFieldId = useId();

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
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <SurfacePanel as="section" variant="solid" padding="lg" reveal className="w-full max-w-md">
        <h1 className="ds-display text-2xl font-semibold text-[color:var(--text-main)]">{pageTitle}</h1>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {isRegisterMode ? (
            <FieldControl label="Name" htmlFor={nameFieldId}>
              <input
                id={nameFieldId}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={2}
                className={CONTROL_INPUT_CLASS_NAME}
              />
            </FieldControl>
          ) : null}

          <FieldControl label="Email" htmlFor={emailFieldId}>
            <input
              id={emailFieldId}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className={CONTROL_INPUT_CLASS_NAME}
            />
          </FieldControl>

          <FieldControl label="Password" htmlFor={passwordFieldId}>
            <div className="relative">
              <input
                id={passwordFieldId}
                type={isPasswordVisible ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                required
                minLength={8}
                className={`${CONTROL_INPUT_CLASS_NAME} pr-10`}
              />
              <button
                type="button"
                onClick={() => setIsPasswordVisible((current) => !current)}
                aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                className="ds-focus-ring absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-lg p-1 text-[color:var(--text-muted)] transition hover:text-[color:var(--text-main)]"
              >
                {isPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </FieldControl>

          {isRegisterMode ? (
            <>
              <FieldControl label="Confirm Password" htmlFor={confirmPasswordFieldId}>
                <div className="relative">
                  <input
                    id={confirmPasswordFieldId}
                    type={isConfirmPasswordVisible ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    className={`${CONTROL_INPUT_CLASS_NAME} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setIsConfirmPasswordVisible((current) => !current)}
                    aria-label={isConfirmPasswordVisible ? 'Hide confirm password' : 'Show confirm password'}
                    className="ds-focus-ring absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-lg p-1 text-[color:var(--text-muted)] transition hover:text-[color:var(--text-main)]"
                  >
                    {isConfirmPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </FieldControl>

              <FieldControl label="Default Currency" htmlFor={currencyFieldId}>
                <select
                  id={currencyFieldId}
                  value={defaultCurrency}
                  onChange={(event) => setDefaultCurrency(event.target.value)}
                  required
                  className={CONTROL_INPUT_CLASS_NAME}
                >
                  {SUPPORTED_CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </FieldControl>
            </>
          ) : null}

          {errorMessage ? <StatusBanner tone="danger">{errorMessage}</StatusBanner> : null}

          <ActionButton type="submit" disabled={isSubmitting} fullWidth>
            {isSubmitting ? 'Processing...' : submitLabel}
          </ActionButton>
        </form>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-[color:var(--surface-border)]" />
          <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">OR</span>
          <span className="h-px flex-1 bg-[color:var(--surface-border)]" />
        </div>

        <div className="flex min-h-[40px] justify-center">
          {isGoogleSubmitting ? (
            <p className="text-sm text-[color:var(--text-muted)]">Processing Google sign-in...</p>
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

        <p className="mt-5 text-sm text-[color:var(--text-muted)]">
          {alternateLabel}{' '}
          <Link
            to={alternateRoute}
            className="font-semibold text-[color:var(--accent)] underline-offset-4 transition hover:text-[color:var(--accent-strong)] hover:underline"
          >
            {alternateAction}
          </Link>
        </p>
      </SurfacePanel>
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
