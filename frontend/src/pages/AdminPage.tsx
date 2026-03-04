import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/dashboard/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ApiClientError, fetchAdminOverview } from '../services/api';
import type { AdminOverviewResponse } from '../types/finance';

const INITIAL_OVERVIEW: AdminOverviewResponse = {
  summary: {
    totalUsers: 0,
  },
  users: [],
};

export function AdminPage(): JSX.Element {
  const { token, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();
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

  function handleLogout(): void {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#eef0f1] p-3 dark:bg-[#020617] lg:p-5">
      <div className="mx-auto max-w-[1380px] overflow-hidden rounded-[28px] border border-slate-200 bg-[#f6f7f8] shadow-[0_18px_45px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-[#0b1220] dark:shadow-[0_20px_55px_rgba(2,6,23,0.85)]">
        <div className="lg:grid lg:grid-cols-[240px_1fr]">
          <Sidebar isDarkMode={isDarkMode} onToggleTheme={toggleTheme} activeItem="admin" />

          <main className="space-y-4 p-4 lg:p-6" aria-live="polite">
            <header className="rounded-xl bg-slate-50 px-6 py-6 dark:bg-slate-950/50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                    Admin
                  </h1>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Overview of registered accounts on the platform.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setReloadKey((value) => value + 1)}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </header>

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
                            <td className="px-6 py-3 font-medium text-slate-800 dark:text-slate-100">
                              {user.name}
                            </td>
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
          </main>
        </div>
      </div>
    </div>
  );
}
