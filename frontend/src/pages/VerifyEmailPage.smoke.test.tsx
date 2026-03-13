import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, confirmEmailVerification } from '../services/api';
import { VerifyEmailPage } from './VerifyEmailPage';

vi.mock('../services/api', () => ({
  ApiClientError: class ApiClientError extends Error {
    readonly status: number;
    readonly details?: unknown;

    constructor(message: string, status = 400, details?: unknown) {
      super(message);
      this.status = status;
      this.details = details;
    }
  },
  confirmEmailVerification: vi.fn(),
}));

const confirmEmailVerificationMock = vi.mocked(confirmEmailVerification);

function renderPage(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('VerifyEmailPage smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('confirms token from query string and shows success state', async () => {
    confirmEmailVerificationMock.mockResolvedValue({
      message: 'Email confirmado com sucesso.',
    });

    renderPage('/verify-email?token=abc.def.ghi');

    await waitFor(() => {
      expect(confirmEmailVerificationMock).toHaveBeenCalledWith('abc.def.ghi');
    });

    expect(screen.getByText('Email confirmado com sucesso.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ir para Login' }).getAttribute('href')).toBe('/login');
  });

  it('shows an error when token is missing', async () => {
    renderPage('/verify-email');

    await waitFor(() => {
      expect(screen.getByText('Token de confirmação em falta.')).toBeTruthy();
    });

    expect(confirmEmailVerificationMock).not.toHaveBeenCalled();
  });

  it('shows api error message when confirmation fails', async () => {
    confirmEmailVerificationMock.mockRejectedValue(
      new ApiClientError('Token de confirmação inválido ou expirado.', 400),
    );

    renderPage('/verify-email?token=invalid');

    await waitFor(() => {
      expect(screen.getByText('Token de confirmação inválido ou expirado.')).toBeTruthy();
    });
  });
});
