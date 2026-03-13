import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { StatusBanner } from '../components/design/StatusBanner';
import { SurfacePanel } from '../components/design/SurfacePanel';
import { ApiClientError, confirmEmailVerification } from '../services/api';

type VerificationState = 'idle' | 'loading' | 'success' | 'error';

export function VerifyEmailPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<VerificationState>('idle');
  const [message, setMessage] = useState<string>('');

  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams]);

  useEffect(() => {
    let isMounted = true;

    async function runConfirmation(): Promise<void> {
      if (!token) {
        setState('error');
        setMessage('Token de confirmação em falta.');
        return;
      }

      setState('loading');
      setMessage('A confirmar email...');

      try {
        const result = await confirmEmailVerification(token);

        if (!isMounted) {
          return;
        }

        setState('success');
        setMessage(result.message || 'Email confirmado com sucesso.');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiClientError) {
          setMessage(error.message);
        } else if (error instanceof Error) {
          setMessage(error.message);
        } else {
          setMessage('Não foi possível confirmar o email.');
        }

        setState('error');
      }
    }

    void runConfirmation();

    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <SurfacePanel as="section" variant="solid" padding="lg" reveal className="w-full max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
          Verificação de Email
        </p>
        <h1 className="ds-display mt-3 text-3xl font-semibold text-[color:var(--text-main)]">
          Confirmação de registo
        </h1>

        <div className="mt-5">
          {state === 'success' ? (
            <StatusBanner tone="success">{message}</StatusBanner>
          ) : state === 'error' ? (
            <StatusBanner tone="danger">{message}</StatusBanner>
          ) : (
            <StatusBanner tone="info">{message || 'A processar...'}</StatusBanner>
          )}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/login"
            className="ds-focus-ring inline-flex h-10 items-center justify-center rounded-xl border border-transparent bg-[linear-gradient(120deg,var(--accent)_0%,var(--accent-strong)_100%)] px-4 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(15,118,110,0.25)] transition hover:brightness-[1.06]"
          >
            Ir para Login
          </Link>
          <Link
            to="/register"
            className="ds-focus-ring inline-flex h-10 items-center justify-center rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-4 text-sm font-semibold text-[color:var(--text-main)] transition hover:bg-[color:var(--surface-muted)]"
          >
            Criar nova conta
          </Link>
        </div>
      </SurfacePanel>
    </main>
  );
}
