import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { fetchCurrentUser, loginUser } from '../services/api';
import type { ApiUser } from '../types/finance';

vi.mock('../services/api', () => ({
  fetchCurrentUser: vi.fn(),
  loginUser: vi.fn(),
  loginWithGoogle: vi.fn(),
  logoutSession: vi.fn(),
  registerUser: vi.fn(),
}));

const TOKEN_STORAGE_KEY = 'app_financas_auth_token';
const fetchCurrentUserMock = vi.mocked(fetchCurrentUser);
const loginUserMock = vi.mocked(loginUser);

function buildUser(): ApiUser {
  return {
    id: 'user-1',
    name: 'Auth User',
    email: 'auth.user@app.local',
    role: 'USER',
    defaultCurrency: 'EUR',
    avatarUrl: null,
    createdAt: '2026-03-12T00:00:00.000Z',
    updatedAt: '2026-03-12T00:00:00.000Z',
  };
}

function Probe(): JSX.Element {
  const { token, isInitializing, login } = useAuth();

  return (
    <div>
      <span data-testid="token">{token ?? 'null'}</span>
      <span data-testid="is-initializing">{isInitializing ? 'true' : 'false'}</span>
      <button
        type="button"
        onClick={() =>
          void login({
            email: 'auth.user@app.local',
            password: 'Str0ngPass!123',
          })
        }
      >
        login
      </button>
    </div>
  );
}

describe('AuthContext smoke', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('uses JWT from login response and stores it for bearer fallback', async () => {
    fetchCurrentUserMock.mockRejectedValueOnce(new Error('no cookie session'));
    loginUserMock.mockResolvedValueOnce({
      user: buildUser(),
      token: 'jwt.header.signature',
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-initializing').textContent).toBe('false');
    });

    await userEvent.setup().click(screen.getByRole('button', { name: 'login' }));

    await waitFor(() => {
      expect(screen.getByTestId('token').textContent).toBe('jwt.header.signature');
    });

    expect(window.sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBe('jwt.header.signature');
  });

  it('falls back to cookie session when stored token is invalid/expired', async () => {
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY, 'jwt.invalid.signature');
    fetchCurrentUserMock.mockRejectedValueOnce(new Error('expired token')).mockResolvedValueOnce(buildUser());

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-initializing').textContent).toBe('false');
    });

    expect(fetchCurrentUserMock).toHaveBeenCalledTimes(2);
    expect(fetchCurrentUserMock.mock.calls[0]?.[0]).toBe('jwt.invalid.signature');
    expect(fetchCurrentUserMock.mock.calls[1]?.[0]).toBeUndefined();
    expect(screen.getByTestId('token').textContent).toBe('cookie-session');
    expect(window.sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });
});
