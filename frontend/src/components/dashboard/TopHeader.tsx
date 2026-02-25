type TopHeaderProps = {
  balanceLabel: string;
  userName: string;
};

export function TopHeader({ balanceLabel, userName }: TopHeaderProps): JSX.Element {
  return (
    <header className="rounded-xl bg-slate-50 px-6 py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-3xl font-semibold tracking-tight text-slate-900">{balanceLabel}</p>
          <p className="text-sm text-slate-500">Your Total Balance as of Today</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 transition hover:bg-white hover:text-slate-900"
          >
            <SearchIcon />
            Search
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 transition hover:bg-white hover:text-slate-900"
          >
            <BellIcon />
            Notifications
          </button>

          <button
            type="button"
            aria-label="Open quick actions"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100"
          >
            <GridIcon />
          </button>

          <span className="ml-2 text-sm font-medium text-slate-800">{userName}</span>

          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-cyan-100 text-xs font-semibold text-cyan-700">
            GM
          </span>

          <button
            type="button"
            aria-label="Add item"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-white transition hover:bg-slate-800"
          >
            <PlusIcon />
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
