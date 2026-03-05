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
    <div className="min-h-screen bg-[#eef0f1] p-3 dark:bg-[#020617] lg:p-5">
      <div className="mx-auto max-w-[1380px] overflow-hidden rounded-[28px] border border-slate-200 bg-[#f6f7f8] shadow-[0_18px_45px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-[#0b1220] dark:shadow-[0_20px_55px_rgba(2,6,23,0.85)]">
        <div className="lg:grid lg:grid-cols-[240px_1fr]">
          <Sidebar
            isDarkMode={isDarkMode}
            onToggleTheme={toggleTheme}
            activeItem={activeItem}
            mobileHeaderRightSlot={<UserMenu compact />}
          />

          <main className={mainClassName ?? 'space-y-4 p-4 lg:p-6'} aria-live="polite">
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
