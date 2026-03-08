import { useEffect, useState } from 'react';
import { MonthYearSelector } from '../common/MonthYearSelector';
import { useSearch } from '../../context/SearchContext';
import { useDebounce } from '../../hooks/useDebounce';

type TopHeaderProps = {
  balanceLabel: string;
  isBalanceNegative: boolean;
  onAddTransaction: () => void;
  onImportCsv: () => void;
};

export function TopHeader({
  balanceLabel,
  isBalanceNegative,
  onAddTransaction,
  onImportCsv,
}: TopHeaderProps): JSX.Element {
  const { searchQuery, setSearchQuery } = useSearch();
  const [searchInput, setSearchInput] = useState<string>(searchQuery);
  const debouncedSearchInput = useDebounce(searchInput, 500);

  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (debouncedSearchInput === searchQuery) {
      return;
    }

    setSearchQuery(debouncedSearchInput);
  }, [debouncedSearchInput, searchQuery, setSearchQuery]);

  return (
    <header className="rounded-2xl border border-slate-200/70 bg-white/75 px-5 py-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-950/45 dark:shadow-[0_24px_45px_rgba(2,6,23,0.65)] lg:px-6 lg:py-6">
      <div className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Financial Overview
            </p>
            <p
              className={[
                'text-3xl font-semibold tracking-tight sm:whitespace-nowrap',
                isBalanceNegative
                  ? 'text-rose-600 dark:text-rose-300'
                  : 'text-slate-900 dark:text-slate-100',
              ].join(' ')}
            >
              {balanceLabel}
            </p>
            <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              Your balance, category spending, and recent activity for the selected month.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 xl:justify-end">
            <MonthYearSelector variant="dashboardTopbar" className="shrink-0" />

            <button
              type="button"
              onClick={onAddTransaction}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-4 text-sm font-semibold text-white shadow-md shadow-cyan-500/25 transition hover:from-blue-500 hover:to-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 active:scale-95"
            >
              <PlusIcon />
              Add Transaction
            </button>

            <button
              type="button"
              onClick={onImportCsv}
              className="inline-flex h-10 items-center rounded-lg border border-slate-300/80 bg-white/70 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 dark:border-slate-700 dark:bg-slate-900/65 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Import CSV
            </button>
          </div>
        </div>

        <label className="relative block w-full max-w-4xl">
          <span className="sr-only">Search transactions</span>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-400">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search transactions..."
            className="h-11 w-full rounded-xl border border-slate-300/50 bg-slate-800/50 pl-10 pr-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-300/90 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/35 dark:border-slate-700/60 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder:text-slate-400"
          />
        </label>
      </div>
    </header>
  );
}

function SearchIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-4.2-4.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon(): JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
