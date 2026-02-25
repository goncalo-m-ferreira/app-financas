import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChartCards } from '../components/dashboard/ChartCards';
import { NewTransactionModal } from '../components/dashboard/NewTransactionModal';
import { Sidebar } from '../components/dashboard/Sidebar';
import { TopHeader } from '../components/dashboard/TopHeader';
import { TransactionsList } from '../components/dashboard/TransactionsList';
import { useAuth } from '../context/AuthContext';
import { ApiClientError, createTransaction, fetchDashboardData } from '../services/api';
import type { CreateTransactionInput, DashboardApiData } from '../types/finance';
import {
  buildAssetsBars,
  buildPerformanceSeries,
  buildTransactionGroups,
  calculateTotalBalance,
  formatTotalBalance,
} from '../utils/dashboard';

const INITIAL_DASHBOARD: DashboardApiData = {
  user: {
    id: '',
    name: 'Utilizador',
    email: '',
    defaultCurrency: 'EUR',
    createdAt: '',
    updatedAt: '',
  },
  categories: [],
  transactions: [],
  balance: '0.00',
};

export function DashboardPage(): JSX.Element {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardApiData>(INITIAL_DASHBOARD);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    const tokenValue = token;
    const controller = new AbortController();
    let isMounted = true;

    async function loadDashboard(): Promise<void> {
      try {
        setLoading(true);
        setErrorMessage(null);

        const result = await fetchDashboardData(tokenValue, controller.signal);

        if (!isMounted) {
          return;
        }

        setDashboard(result);
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

        setErrorMessage('Falha inesperada ao carregar dashboard.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [reloadKey, token]);

  const currency = dashboard.user.defaultCurrency || user?.defaultCurrency || 'EUR';
  const userName = dashboard.user.name || user?.name || 'Guest User';

  const totalBalanceLabel = useMemo(() => {
    const totalBalance = calculateTotalBalance(dashboard.transactions);
    return formatTotalBalance(totalBalance, currency);
  }, [currency, dashboard.transactions]);

  const assetsBars = useMemo(
    () => buildAssetsBars(dashboard.transactions, dashboard.categories),
    [dashboard.categories, dashboard.transactions],
  );

  const performanceSeries = useMemo(
    () => buildPerformanceSeries(dashboard.transactions),
    [dashboard.transactions],
  );

  const transactionGroups = useMemo(
    () => buildTransactionGroups(dashboard.transactions, currency),
    [currency, dashboard.transactions],
  );

  async function handleCreateTransaction(payload: CreateTransactionInput): Promise<void> {
    if (!token) {
      throw new Error('Sessão expirada. Faz login novamente.');
    }

    const createdTransaction = await createTransaction(token, payload);

    setDashboard((current) => ({
      ...current,
      transactions: [createdTransaction, ...current.transactions],
      balance: calculateTotalBalance([createdTransaction, ...current.transactions]).toFixed(2),
    }));
  }

  function handleLogout(): void {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <>
      <div className="min-h-screen bg-[#eef0f1] p-3 lg:p-5">
        <div className="mx-auto max-w-[1380px] overflow-hidden rounded-[28px] border border-slate-200 bg-[#f6f7f8] shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <div className="lg:grid lg:grid-cols-[240px_1fr]">
            <Sidebar />

            <main className="space-y-4 p-4 lg:p-6" aria-live="polite">
              <TopHeader
                balanceLabel={totalBalanceLabel}
                userName={userName}
                onAddTransaction={() => setIsModalOpen(true)}
                onLogout={handleLogout}
              />

              {loading ? (
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                  A carregar dados da API...
                </div>
              ) : null}

              {errorMessage ? (
                <section className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                  <p>{errorMessage}</p>
                  <button
                    type="button"
                    onClick={() => setReloadKey((value) => value + 1)}
                    className="mt-3 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-rose-500"
                  >
                    Tentar novamente
                  </button>
                </section>
              ) : null}

              {!errorMessage ? (
                <>
                  <ChartCards assetsBars={assetsBars} performanceSeries={performanceSeries} />
                  <TransactionsList groups={transactionGroups} />
                </>
              ) : null}
            </main>
          </div>
        </div>
      </div>

      <NewTransactionModal
        open={isModalOpen}
        categories={dashboard.categories}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateTransaction}
      />
    </>
  );
}
