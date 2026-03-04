import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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

const secondaryItems: NavItem[] = [{ id: 'settings', label: 'Settings', icon: <GearIcon />, href: '/settings' }];
const adminItem: NavItem = { id: 'admin', label: 'Admin', icon: <ShieldIcon />, href: '/admin' };

type SidebarProps = {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  activeItem: 'home' | 'dashboard' | 'accounts' | 'budgets' | 'reports' | 'mailbox' | 'settings' | 'admin';
};

type SidebarContentProps = SidebarProps & {
  unreadCount: number;
  isAdmin: boolean;
  onNavigate?: () => void;
  showTopMark?: boolean;
};

function SidebarContent({
  isDarkMode,
  onToggleTheme,
  activeItem,
  unreadCount,
  isAdmin,
  onNavigate,
  showTopMark = false,
}: SidebarContentProps): JSX.Element {
  const visibleSecondaryItems = isAdmin ? [adminItem, ...secondaryItems] : secondaryItems;

  return (
    <>
      {showTopMark ? (
        <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
          <PlusMarkIcon />
        </div>
      ) : null}

      <nav aria-label="Main navigation" className="space-y-1">
        {primaryItems.map((item) => (
          <div key={item.label}>
            {(() => {
              const badgeValue =
                item.id === 'mailbox' ? (unreadCount > 0 ? String(unreadCount) : undefined) : item.badge;

              return item.href ? (
                <Link
                  to={item.href}
                  onClick={onNavigate}
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
        {visibleSecondaryItems.map((item) =>
          item.href ? (
            <Link
              key={item.label}
              to={item.href}
              onClick={onNavigate}
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
          ),
        )}
      </div>

      <button
        type="button"
        onClick={onToggleTheme}
        className="mt-8 flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <span>Switch to dark</span>
        <span className={['h-5 w-9 rounded-full p-0.5 transition', isDarkMode ? 'bg-cyan-400' : 'bg-slate-900'].join(' ')}>
          <span
            className={[
              'block h-4 w-4 rounded-full bg-white transition',
              isDarkMode ? 'translate-x-4' : 'translate-x-0',
            ].join(' ')}
          />
        </span>
      </button>
    </>
  );
}

export function Sidebar({ isDarkMode, onToggleTheme, activeItem }: SidebarProps): JSX.Element {
  const { isAdmin } = useAuth();
  const { unreadCount } = useNotifications();
  const location = useLocation();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    if (!isMobileSidebarOpen) {
      return;
    }

    function handleKeydown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setIsMobileSidebarOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [isMobileSidebarOpen]);

  useEffect(() => {
    if (!isMobileSidebarOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileSidebarOpen]);

  return (
    <>
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 lg:hidden">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
          <PlusMarkIcon />
        </div>

        <button
          type="button"
          onClick={() => setIsMobileSidebarOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={isMobileSidebarOpen}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <MenuIcon />
        </button>
      </header>

      <div
        className={[
          'fixed inset-0 z-40 transition-opacity duration-200 lg:hidden',
          isMobileSidebarOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
        aria-hidden={!isMobileSidebarOpen}
      >
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setIsMobileSidebarOpen(false)}
          className="absolute inset-0 bg-slate-950/45"
        />

        <aside
          className={[
            'absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-slate-200 bg-white px-5 py-6 shadow-xl transition-transform duration-200 dark:border-slate-700 dark:bg-slate-900',
            isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none',
          ].join(' ')}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
        >
          <div className="mb-6 flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
              <PlusMarkIcon />
            </div>

            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(false)}
              aria-label="Close navigation menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <CloseIcon />
            </button>
          </div>

          <SidebarContent
            isDarkMode={isDarkMode}
            onToggleTheme={onToggleTheme}
            activeItem={activeItem}
            unreadCount={unreadCount}
            isAdmin={isAdmin}
            onNavigate={() => setIsMobileSidebarOpen(false)}
          />
        </aside>
      </div>

      <aside className="hidden border-r border-slate-200 bg-white px-5 py-6 dark:border-slate-700 dark:bg-slate-900 lg:block lg:h-screen">
        <SidebarContent
          isDarkMode={isDarkMode}
          onToggleTheme={onToggleTheme}
          activeItem={activeItem}
          unreadCount={unreadCount}
          isAdmin={isAdmin}
          showTopMark
        />
      </aside>
    </>
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

function MenuIcon(): JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon(): JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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

function ShieldIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 5 6v6c0 4.2 2.7 7.9 7 9 4.3-1.1 7-4.8 7-9V6l-7-3z" stroke="currentColor" strokeWidth="2" />
      <path d="M9.5 12.5 11 14l3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
