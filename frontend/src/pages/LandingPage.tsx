import { Link, Navigate } from 'react-router-dom';
import { SurfacePanel } from '../components/design/SurfacePanel';
import { useAuth } from '../context/AuthContext';

export function LandingPage(): JSX.Element {
  const { isAuthenticated, isInitializing } = useAuth();

  if (!isInitializing && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <SurfacePanel as="section" variant="solid" padding="lg" reveal className="w-full max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-muted)]">App Finanças</p>
        <h1 className="ds-display mt-3 text-3xl font-semibold text-[color:var(--text-main)]">Gestão financeira pessoal segura</h1>
        <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)]">
          Entra na tua conta para ver dashboard, transações e categorias isoladas por utilizador.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/login"
            className="ds-focus-ring inline-flex h-10 items-center justify-center rounded-xl border border-transparent bg-[linear-gradient(120deg,var(--accent)_0%,var(--accent-strong)_100%)] px-4 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(15,118,110,0.25)] transition hover:brightness-[1.06]"
          >
            Login
          </Link>
          <Link
            to="/register"
            className="ds-focus-ring inline-flex h-10 items-center justify-center rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-4 text-sm font-semibold text-[color:var(--text-main)] transition hover:bg-[color:var(--surface-muted)]"
          >
            Registar
          </Link>
        </div>
      </SurfacePanel>
    </main>
  );
}
