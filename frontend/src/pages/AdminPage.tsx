import { useEffect, useState } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { PremiumPageHeader } from '../components/layout/PremiumPageHeader';
import { useAuth } from '../context/AuthContext';
import { ApiClientError, fetchAdminOverview } from '../services/api';
import type { AdminOverviewResponse } from '../types/finance';

const INITIAL_OVERVIEW: AdminOverviewResponse = {
  summary: {
    totalUsers: 0,
  },
  users: [],
};

export function AdminPage(): JSX.Element {
  const { token } = useAuth();
  const [overview, setOverview] = useState<AdminOverviewResponse>(INITIAL_OVERVIEW);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);

  useEffect(() => {
    if (!token) {
      return;
    }

    const tokenValue = token;
    const controller = new AbortController();
    let isMounted = true;

    async function loadOverview(): Promise<void> {
      try {
        setLoading(true);
        setErrorMessage(null);

        const result = await fetchAdminOverview(tokenValue, 20, controller.signal);

        if (!isMounted) {
          return;
        }

        setOverview(result);
      } catch (error) {
        if (!isMounted || controller.signal.aborted) {
          return;
        }

        if (error instanceof ApiClientError) {
          setErrorMessage(error.message);
          return;
        }

        if (error instanceof Error) {
          setErrorMessage(error.message);
          return;
        }

        setErrorMessage('Falha ao carregar dados administrativos.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadOverview();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [reloadKey, token]);

  return (
    <AppShell activeItem="admin">
      <PremiumPageHeader
        title="Admin"
        description="Overview of registered accounts on the platform."
        actions={
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className="inline-flex h-10 items-center rounded-lg border border-slate-300/80 bg-white/70 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 dark:border-slate-700 dark:bg-slate-900/65 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Refresh
          </button>
        }
      />

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Total Accounts</p>
        <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">
          {overview.summary.totalUsers}
        </p>
      </section>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          Loading admin overview...
        </div>
      ) : null}

      {errorMessage ? (
        <section className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          <p>{errorMessage}</p>
        </section>
      ) : null}

      {!loading && !errorMessage ? (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <header className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Latest 20 Users
            </h2>
          </header>

          {overview.users.length === 0 ? (
            <div className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
              No users were found in the database.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">Created At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {overview.users.map((user) => (
                    <tr key={user.id} className="bg-white dark:bg-slate-900">
                      <td className="px-6 py-3 font-medium text-slate-800 dark:text-slate-100">{user.name}</td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{user.email}</td>
                      <td className="px-6 py-3">
                        <span
                          className={[
                            'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
                            user.role === 'ADMIN'
                              ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
                          ].join(' ')}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                        {new Intl.DateTimeFormat('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(new Date(user.createdAt))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </AppShell>
  );
}
