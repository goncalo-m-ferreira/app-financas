import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function LandingPage(): JSX.Element {
  const { isAuthenticated, isInitializing } = useAuth();

  if (!isInitializing && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">App Finanças</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">Gestão financeira pessoal segura</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Entra na tua conta para ver dashboard, transações e categorias isoladas por utilizador.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/login"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Login
          </Link>
          <Link
            to="/register"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Registar
          </Link>
        </div>
      </section>
    </main>
  );
}
