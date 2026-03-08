import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { Sidebar } from './Sidebar';

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../context/NotificationContext', () => ({
  useNotifications: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseNotifications = vi.mocked(useNotifications);

describe('Sidebar labels', () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      token: 'token-sidebar',
      user: {
        id: 'user-1',
        name: 'Sidebar User',
        email: 'sidebar.user@app.local',
        role: 'USER',
        defaultCurrency: 'EUR',
        avatarUrl: null,
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
      isAuthenticated: true,
      isAdmin: false,
      isInitializing: false,
      login: vi.fn(),
      loginWithGoogleCredential: vi.fn(),
      register: vi.fn(),
      setAuthenticatedUser: vi.fn(),
      logout: vi.fn(),
    });

    mockedUseNotifications.mockReturnValue({
      unreadCount: 0,
      refreshUnreadCount: vi.fn(),
      markOneAsReadLocally: vi.fn(),
    });
  });

  it('shows Financial Overview nav label and Dark mode toggle copy', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Sidebar
          isDarkMode={true}
          onToggleTheme={vi.fn()}
          activeItem="dashboard"
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /Financial Overview/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Dark mode/i })).toBeTruthy();
    expect(screen.queryByText('Assets & Investments')).toBeNull();
    expect(screen.queryByText('Switch to dark')).toBeNull();
  });
});
