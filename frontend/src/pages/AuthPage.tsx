import { useMemo, useState, type FormEvent } from 'react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
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
  const [defaultCurrency, setDefaultCurrency] = useState<string>('CHF');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isRegisterMode = mode === 'register';
  const pageTitle = isRegisterMode ? 'Criar conta' : 'Entrar';
  const submitLabel = isRegisterMode ? 'Registar' : 'Login';
  const alternateLabel = isRegisterMode ? 'Já tens conta?' : 'Ainda não tens conta?';
  const alternateRoute = isRegisterMode ? '/login' : '/register';
  const alternateAction = isRegisterMode ? 'Fazer login' : 'Registar';

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
        setErrorMessage('Falha inesperada na autenticação.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSuccess(response: CredentialResponse): Promise<void> {
    if (!response.credential) {
      setErrorMessage('Credencial Google inválida. Tenta novamente.');
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
        setErrorMessage('Falha inesperada no login Google.');
      }
    } finally {
      setIsGoogleSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">{pageTitle}</h1>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {isRegisterMode ? (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Nome</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={2}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
              />
            </label>
          ) : null}

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            />
          </label>

          {isRegisterMode ? (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Moeda padrão</span>
              <input
                value={defaultCurrency}
                onChange={(event) => setDefaultCurrency(event.target.value)}
                required
                maxLength={3}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase text-slate-900 outline-none transition focus:border-slate-500"
              />
            </label>
          ) : null}

          {errorMessage ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'A processar...' : submitLabel}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">OR</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="flex min-h-[40px] justify-center">
          {isGoogleSubmitting ? (
            <p className="text-sm text-slate-600">A processar login Google...</p>
          ) : (
            <GoogleLogin
              onSuccess={(credentialResponse) => {
                void handleGoogleSuccess(credentialResponse);
              }}
              onError={() => {
                setErrorMessage('Falha no login Google. Tenta novamente.');
              }}
              text={isRegisterMode ? 'signup_with' : 'signin_with'}
            />
          )}
        </div>

        <p className="mt-5 text-sm text-slate-600">
          {alternateLabel}{' '}
          <Link to={alternateRoute} className="font-semibold text-slate-900 underline-offset-4 hover:underline">
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
