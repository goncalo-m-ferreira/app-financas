import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';

type NavItem = {
  id: string;
  label: string;
  icon: ReactNode;
  href?: string;
  badge?: string;
  children?: string[];
};

const primaryItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: <DotIcon />, href: '/' },
  { id: 'dashboard', label: 'Assets & Investments', icon: <PieIcon />, href: '/dashboard' },
  { id: 'accounts', label: 'Accounts & Cards', icon: <CardIcon />, href: '/accounts' },
  { id: 'budgets', label: 'Budget', icon: <WalletIcon />, href: '/budgets' },
  { id: 'reports', label: 'Reports', icon: <ReportIcon />, href: '/reports' },
  { id: 'mailbox', label: 'Mailbox', icon: <MailIcon />, href: '/mailbox' },
];

const secondaryItems: NavItem[] = [
  { id: 'settings', label: 'Settings', icon: <GearIcon />, href: '/settings' },
];

type SidebarProps = {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  activeItem: 'home' | 'dashboard' | 'accounts' | 'budgets' | 'reports' | 'mailbox' | 'settings';
};

export function Sidebar({ isDarkMode, onToggleTheme, activeItem }: SidebarProps): JSX.Element {
  const { unreadCount } = useNotifications();

  return (
    <aside className="border-b border-slate-200 bg-white px-5 py-6 dark:border-slate-700 dark:bg-slate-900 lg:h-screen lg:border-b-0 lg:border-r">
      <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
        <PlusMarkIcon />
      </div>

      <nav aria-label="Main navigation" className="space-y-1">
        {primaryItems.map((item) => (
          <div key={item.label}>
            {(() => {
              const badgeValue = item.id === 'mailbox' ? (unreadCount > 0 ? String(unreadCount) : undefined) : item.badge;

              return item.href ? (
                <Link
                  to={item.href}
                  className={[
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition',
                    item.id === activeItem
                      ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100',
                  ].join(' ')}
                  aria-current={item.id === activeItem ? 'page' : undefined}
                >
                  <span
                    className={
                      item.id === activeItem
                        ? 'text-white dark:text-slate-900'
                        : 'text-slate-400 dark:text-slate-500'
                    }
                  >
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                  {badgeValue ? (
                    <span className="ml-auto rounded bg-slate-200 px-1.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                      {badgeValue}
                    </span>
                  ) : null}
                </Link>
              ) : (
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                >
                  <span className="text-slate-400 dark:text-slate-500">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                  {badgeValue ? (
                    <span className="ml-auto rounded bg-slate-200 px-1.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                      {badgeValue}
                    </span>
                  ) : null}
                </button>
              );
            })()}

            {item.children ? (
              <ul
                className="space-y-1 pl-11 pt-2 text-xs text-slate-500 dark:text-slate-400"
                aria-label={`${item.label} accounts`}
              >
                {item.children.map((child) => (
                  <li key={child} className="truncate">
                    {child}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </nav>

      <div className="mt-10 space-y-1 border-t border-slate-100 pt-6 dark:border-slate-800">
        {secondaryItems.map((item) => (
          item.href ? (
            <Link
              key={item.label}
              to={item.href}
              className={[
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition',
                item.id === activeItem
                  ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100',
              ].join(' ')}
              aria-current={item.id === activeItem ? 'page' : undefined}
            >
              <span
                className={
                  item.id === activeItem
                    ? 'text-white dark:text-slate-900'
                    : 'text-slate-400 dark:text-slate-500'
                }
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          ) : (
            <button
              key={item.label}
              type="button"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <span className="text-slate-400 dark:text-slate-500">{item.icon}</span>
              {item.label}
            </button>
          )
        ))}
      </div>

      <button
        type="button"
        onClick={onToggleTheme}
        className="mt-8 flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <span>Switch to dark</span>
        <span
          className={[
            'h-5 w-9 rounded-full p-0.5 transition',
            isDarkMode ? 'bg-cyan-400' : 'bg-slate-900',
          ].join(' ')}
        >
          <span
            className={[
              'block h-4 w-4 rounded-full bg-white transition',
              isDarkMode ? 'translate-x-4' : 'translate-x-0',
            ].join(' ')}
          />
        </span>
      </button>
    </aside>
  );
}

function PlusMarkIcon(): JSX.Element {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="text-slate-900 dark:text-slate-100"
      />
    </svg>
  );
}

function DotIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 12 6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PieIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
      <path d="M12 4v8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CardIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function WalletIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 8h16v10H4z" stroke="currentColor" strokeWidth="2" />
      <path d="M16 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ReportIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 3h8l4 4v14H4V3h4z" stroke="currentColor" strokeWidth="2" />
      <path d="M16 3v4h4M8 13h8M8 17h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MailIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="m5 8 7 5 7-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function GearIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
