import { useEffect, useState } from 'react';
import { MonthYearSelector } from '../common/MonthYearSelector';
import { useSearch } from '../../context/SearchContext';
import { useDebounce } from '../../hooks/useDebounce';

type TopHeaderProps = {
  balanceLabel: string;
  onAddTransaction: () => void;
  onImportCsv: () => void;
};

export function TopHeader({
  balanceLabel,
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
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,460px)_minmax(0,1fr)] xl:items-center">
        <div className="flex flex-col justify-center gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            Assets & Investments
          </p>
          <p className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {balanceLabel}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Your Total Balance for the Selected Month
          </p>
        </div>

        <label className="relative block w-full xl:mx-auto xl:max-w-[460px]">
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

        <div className="flex flex-wrap items-center gap-4 xl:justify-end">
          <MonthYearSelector variant="dashboardTopbar" />

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled
              title="Coming Soon"
              aria-label="Notifications (Coming Soon)"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/70 bg-white/75 text-slate-500 opacity-40 shadow-sm disabled:cursor-not-allowed dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-400"
            >
              <BellIcon />
            </button>

            <button
              type="button"
              disabled
              title="Coming Soon"
              aria-label="Open quick actions (Coming Soon)"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/70 bg-white/75 text-slate-500 opacity-40 shadow-sm disabled:cursor-not-allowed dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-400"
            >
              <GridIcon />
            </button>
          </div>

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

function BellIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4a4 4 0 0 0-4 4v3.7L6 14v1h12v-1l-2-2.3V8a4 4 0 0 0-4-4z" stroke="currentColor" strokeWidth="2" />
      <path d="M10 18a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function GridIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="4" height="4" fill="currentColor" />
      <rect x="10" y="4" width="4" height="4" fill="currentColor" />
      <rect x="16" y="4" width="4" height="4" fill="currentColor" />
      <rect x="4" y="10" width="4" height="4" fill="currentColor" />
      <rect x="10" y="10" width="4" height="4" fill="currentColor" />
      <rect x="16" y="10" width="4" height="4" fill="currentColor" />
      <rect x="4" y="16" width="4" height="4" fill="currentColor" />
      <rect x="10" y="16" width="4" height="4" fill="currentColor" />
      <rect x="16" y="16" width="4" height="4" fill="currentColor" />
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
