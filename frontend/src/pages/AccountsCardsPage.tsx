import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ActionButton } from '../components/design/ActionButton';
import { CONTROL_INPUT_CLASS_NAME, FieldControl } from '../components/design/FieldControl';
import { StatusBanner } from '../components/design/StatusBanner';
import { SurfacePanel } from '../components/design/SurfacePanel';
import { AppShell } from '../components/layout/AppShell';
import { PremiumPageHeader } from '../components/layout/PremiumPageHeader';
import { useAuth } from '../context/AuthContext';
import { ApiClientError, createWallet, deleteWallet, fetchWallets } from '../services/api';
import type { ApiWallet } from '../types/finance';

const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6})$/;
const DEFAULT_WALLET_COLOR = '#0ea5e9';

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(value)
    .replace(/,/g, "'")
    .concat(` ${currency}`);
}

function parseHexColor(value: string | null): string {
  if (typeof value === 'string' && HEX_COLOR_REGEX.test(value.trim())) {
    return value.trim();
  }

  return DEFAULT_WALLET_COLOR;
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = parseHexColor(hex);
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function cardLast4(walletId: string): string {
  const onlyDigits = walletId.replace(/\D/g, '');

  if (onlyDigits.length >= 4) {
    return onlyDigits.slice(-4).padStart(4, '0');
  }

  const checksum = [...walletId].reduce((value, char) => (value * 31 + char.charCodeAt(0)) % 10000, 0);
  return String(checksum).padStart(4, '0');
}

export function AccountsCardsPage(): JSX.Element {
  const { token, user } = useAuth();
  const [wallets, setWallets] = useState<ApiWallet[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [walletName, setWalletName] = useState<string>('');
  const [walletColor, setWalletColor] = useState<string>(DEFAULT_WALLET_COLOR);
  const [walletBalance, setWalletBalance] = useState<string>('0');
  const [isCreatingWallet, setIsCreatingWallet] = useState<boolean>(false);
  const [deletingWalletIds, setDeletingWalletIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!token) {
      return;
    }

    const tokenValue = token;
    const controller = new AbortController();
    let isMounted = true;

    async function loadWallets(): Promise<void> {
      try {
        setLoading(true);
        setErrorMessage(null);

        const walletsData = await fetchWallets(tokenValue, controller.signal);

        if (!isMounted) {
          return;
        }

        setWallets(walletsData);
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

        setErrorMessage('Unexpected error while loading accounts.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadWallets();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [token]);

  const currency = user?.defaultCurrency ?? 'EUR';

  const sortedWallets = useMemo(
    () => [...wallets].sort((left, right) => left.name.localeCompare(right.name)),
    [wallets],
  );

  function validateColor(value: string): boolean {
    return HEX_COLOR_REGEX.test(value.trim());
  }

  async function handleCreateWallet(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorMessage(null);

    if (!token) {
      setErrorMessage('Session expired. Please sign in again.');
      return;
    }

    const trimmedName = walletName.trim();
    const trimmedColor = walletColor.trim();
    const parsedBalance = Number.parseFloat(walletBalance);

    if (trimmedName.length < 2) {
      setErrorMessage('Wallet name must be at least 2 characters.');
      return;
    }

    if (!validateColor(trimmedColor)) {
      setErrorMessage('Wallet color must use HEX format (#RRGGBB).');
      return;
    }

    if (!Number.isFinite(parsedBalance) || parsedBalance < 0) {
      setErrorMessage('Initial balance must be 0 or greater.');
      return;
    }

    setIsCreatingWallet(true);

    try {
      const created = await createWallet(token, {
        name: trimmedName,
        color: trimmedColor,
        balance: parsedBalance,
      });

      setWallets((current) => [...current, created]);
      setWalletName('');
      setWalletColor(DEFAULT_WALLET_COLOR);
      setWalletBalance('0');
      setIsModalOpen(false);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Failed to create wallet.');
      }
    } finally {
      setIsCreatingWallet(false);
    }
  }

  async function handleDeleteWallet(walletId: string): Promise<void> {
    if (!token) {
      setErrorMessage('Session expired. Please sign in again.');
      return;
    }

    setErrorMessage(null);
    setDeletingWalletIds((current) => new Set(current).add(walletId));

    try {
      await deleteWallet(token, walletId);
      setWallets((current) => current.filter((wallet) => wallet.id !== walletId));
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Failed to delete wallet.');
      }
    } finally {
      setDeletingWalletIds((current) => {
        const next = new Set(current);
        next.delete(walletId);
        return next;
      });
    }
  }

  return (
    <>
      <AppShell activeItem="accounts">
        <PremiumPageHeader
          title="Accounts & Cards"
          description="Manage all your wallets as modern debit and credit cards."
          actions={
            <ActionButton type="button" onClick={() => setIsModalOpen(true)}>
              Add New Account
            </ActionButton>
          }
        />

        {errorMessage ? (
          <StatusBanner tone="danger">
            {errorMessage}
          </StatusBanner>
        ) : null}

        <SurfacePanel as="section" variant="solid" padding="md">
          {loading ? (
            <p className="text-sm text-[color:var(--text-muted)]">Loading accounts...</p>
          ) : sortedWallets.length === 0 ? (
            <SurfacePanel as="div" variant="muted" padding="lg" className="border-dashed text-center">
              <p className="text-sm font-medium text-[color:var(--text-main)]">No accounts found.</p>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                Click "Add New Account" to create your first card.
              </p>
            </SurfacePanel>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sortedWallets.map((wallet) => {
                const displayColor = parseHexColor(wallet.color);
                const parsedBalance = Number.parseFloat(wallet.balance);
                const balanceLabel = formatCurrency(Number.isFinite(parsedBalance) ? parsedBalance : 0, currency);
                const isDeleting = deletingWalletIds.has(wallet.id);

                return (
                  <article
                    key={wallet.id}
                    className="relative overflow-hidden rounded-xl p-5 text-white shadow-[0_16px_30px_rgba(15,23,42,0.28)]"
                    style={{
                      backgroundImage: `linear-gradient(145deg, ${hexToRgba(displayColor, 0.98)} 0%, ${hexToRgba(displayColor, 0.72)} 45%, ${hexToRgba('#0f172a', 0.95)} 120%)`,
                    }}
                  >
                    <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-white/20 blur-2xl" />
                    <div className="relative z-10">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <CardChipIcon />
                          <span className="rounded-full border border-white/35 bg-white/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.2em] text-white/90">
                            Debit
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleDeleteWallet(wallet.id)}
                          disabled={isDeleting}
                          className="ds-focus-ring rounded-md border border-white/35 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-70"
                          aria-label={`Delete account ${wallet.name}`}
                        >
                          {isDeleting ? 'Removing...' : 'Delete'}
                        </button>
                      </div>

                      <p className="mt-9 font-mono text-lg tracking-[0.25em] text-white/95">
                        **** **** **** {cardLast4(wallet.id)}
                      </p>

                      <div className="mt-6 flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.2em] text-white/70">Wallet</p>
                          <p className="mt-1 truncate text-base font-semibold text-white">{wallet.name}</p>
                        </div>

                        <div className="text-right">
                          <p className="text-xs uppercase tracking-[0.2em] text-white/70">Balance</p>
                          <p className="mt-1 text-xl font-semibold text-white">{balanceLabel}</p>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </SurfacePanel>
      </AppShell>

      {isModalOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-account-title"
        >
          <SurfacePanel as="div" variant="solid" padding="md" className="w-full max-w-xl shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="new-account-title" className="ds-display text-lg font-semibold text-[color:var(--text-main)]">
                Add New Account
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="ds-focus-ring rounded-md px-2 py-1 text-sm text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--text-main)]"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateWallet} className="grid gap-3 md:grid-cols-[1fr_180px_140px]">
              <FieldControl label="Name" htmlFor="wallet-name">
                <input
                  id="wallet-name"
                  value={walletName}
                  onChange={(event) => setWalletName(event.target.value)}
                  required
                  maxLength={80}
                  placeholder="e.g. Platinum Visa"
                  className={CONTROL_INPUT_CLASS_NAME}
                />
              </FieldControl>

              <FieldControl label="Color" htmlFor="wallet-color">
                <div className="flex items-center gap-2">
                  <input
                    id="wallet-color"
                    type="color"
                    value={validateColor(walletColor) ? walletColor : DEFAULT_WALLET_COLOR}
                    onChange={(event) => setWalletColor(event.target.value)}
                    aria-label="Choose account color"
                    className="h-10 w-12 rounded border border-[color:var(--surface-border)] bg-[color:var(--surface-card-strong)] p-1 dark:bg-[color:var(--surface-card)]"
                  />
                  <input
                    value={walletColor}
                    onChange={(event) => setWalletColor(event.target.value)}
                    maxLength={7}
                    placeholder="#0ea5e9"
                    className={CONTROL_INPUT_CLASS_NAME}
                  />
                </div>
              </FieldControl>

              <FieldControl label="Balance" htmlFor="wallet-balance">
                <input
                  id="wallet-balance"
                  type="number"
                  min="0"
                  step="0.01"
                  value={walletBalance}
                  onChange={(event) => setWalletBalance(event.target.value)}
                  className={CONTROL_INPUT_CLASS_NAME}
                />
              </FieldControl>

              <div className="md:col-span-3 flex justify-end gap-2 pt-1">
                <ActionButton type="button" variant="neutral" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </ActionButton>
                <ActionButton type="submit" disabled={isCreatingWallet}>
                  {isCreatingWallet ? 'Adding...' : 'Add Account'}
                </ActionButton>
              </div>
            </form>
          </SurfacePanel>
        </div>
      ) : null}
    </>
  );
}

function CardChipIcon(): JSX.Element {
  return (
    <svg width="28" height="22" viewBox="0 0 28 22" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="26" height="20" rx="4" fill="white" fillOpacity="0.24" />
      <rect x="7" y="6" width="14" height="10" rx="2" fill="white" fillOpacity="0.35" />
      <path d="M14 6v10M7 11h14" stroke="white" strokeOpacity="0.5" />
    </svg>
  );
}
