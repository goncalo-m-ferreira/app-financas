import { useEffect, useState } from 'react';
import { MonthYearSelector } from '../common/MonthYearSelector';
import { useSearch } from '../../context/SearchContext';
import { useDebounce } from '../../hooks/useDebounce';

type TopHeaderProps = {
  balanceLabel: string;
  userName: string;
  onAddTransaction: () => void;
  onImportCsv: () => void;
  onLogout: () => void;
};

export function TopHeader({
  balanceLabel,
  userName,
  onAddTransaction,
  onImportCsv,
  onLogout,
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
    <header className="rounded-xl bg-slate-50 px-6 py-6 dark:bg-slate-950/50">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {balanceLabel}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Your Total Balance for the Selected Month
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
          <MonthYearSelector />

          <label className="relative block">
            <span className="sr-only">Search transactions</span>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search transactions..."
              className="h-9 w-56 rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-500"
            />
          </label>

          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 transition hover:bg-white hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <BellIcon />
            Notifications
          </button>

          <button
            type="button"
            aria-label="Open quick actions"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <GridIcon />
          </button>

          <span className="ml-2 text-sm font-medium text-slate-800 dark:text-slate-100">{userName}</span>

          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-cyan-100 text-xs font-semibold text-cyan-700">
            GM
          </span>

          <button
            type="button"
            onClick={onAddTransaction}
            className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
          >
            <PlusIcon />
            Add Transaction
          </button>

          <button
            type="button"
            onClick={onImportCsv}
            className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Import CSV
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            Logout
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
