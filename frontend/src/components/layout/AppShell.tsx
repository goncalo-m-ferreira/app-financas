import type { PropsWithChildren } from 'react';
import { Sidebar } from '../dashboard/Sidebar';
import { UserMenu } from './UserMenu';
import { useTheme } from '../../context/ThemeContext';

type AppShellProps = PropsWithChildren<{
  activeItem:
    | 'home'
    | 'dashboard'
    | 'accounts'
    | 'budgets'
    | 'recurring'
    | 'reports'
    | 'mailbox'
    | 'categories'
    | 'profile'
    | 'admin';
  mainClassName?: string;
}>;

export function AppShell({ activeItem, children, mainClassName }: AppShellProps): JSX.Element {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-[color:var(--surface-shell)] p-3 lg:p-5">
      <div className="mx-auto max-w-[1380px] overflow-hidden rounded-[28px] border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] shadow-[var(--shadow-soft)] backdrop-blur-md">
        <div className="lg:grid lg:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[240px_1fr]">
          <Sidebar
            isDarkMode={isDarkMode}
            onToggleTheme={toggleTheme}
            activeItem={activeItem}
            mobileHeaderRightSlot={<UserMenu compact />}
          />

          <main className={mainClassName ?? 'space-y-4 p-4 lg:min-h-0 lg:p-6'} aria-live="polite">
            <div className="hidden justify-end lg:flex">
              <UserMenu />
            </div>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
