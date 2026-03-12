import { useEffect, useState } from 'react';
import { MonthYearSelector } from '../common/MonthYearSelector';
import { useSearch } from '../../context/SearchContext';
import { useDebounce } from '../../hooks/useDebounce';
import { ActionButton } from '../design/ActionButton';
import { SurfacePanel } from '../design/SurfacePanel';

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
    <SurfacePanel as="header" variant="glass" padding="lg" reveal>
      <div className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
              Financial Overview
            </p>
            <p
              className={[
                'ds-display text-3xl font-semibold tracking-tight sm:whitespace-nowrap',
                isBalanceNegative ? 'text-rose-600 dark:text-rose-300' : 'text-[color:var(--text-main)]',
              ].join(' ')}
            >
              {balanceLabel}
            </p>
            <p className="max-w-2xl text-sm text-[color:var(--text-muted)]">
              Your balance, category spending, and recent activity for the selected month.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 xl:justify-end">
            <MonthYearSelector variant="dashboardTopbar" className="shrink-0" />

            <ActionButton onClick={onAddTransaction}>
              <PlusIcon />
              Add Transaction
            </ActionButton>

            <ActionButton variant="neutral" onClick={onImportCsv}>
              Import CSV
            </ActionButton>
          </div>
        </div>

        <label className="relative block w-full max-w-4xl">
          <span className="sr-only">Search transactions</span>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)]/75">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search transactions..."
            className="ds-focus-ring h-11 w-full rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card-strong)] pl-10 pr-4 text-sm text-[color:var(--text-main)] outline-none transition placeholder:text-[color:var(--text-muted)]/80 dark:bg-[color:var(--surface-card)]"
          />
        </label>
      </div>
    </SurfacePanel>
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
