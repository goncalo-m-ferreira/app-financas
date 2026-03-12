import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
  registerMock,
  loginMock,
  loginWithGoogleMock,
  setAuthSessionCookiesMock,
} = vi.hoisted(() => ({
  registerMock: vi.fn(),
  loginMock: vi.fn(),
  loginWithGoogleMock: vi.fn(),
  setAuthSessionCookiesMock: vi.fn(),
}));

vi.mock('../src/services/auth.service.js', () => ({
  register: registerMock,
  login: loginMock,
  loginWithGoogle: loginWithGoogleMock,
  getAuthenticatedUser: vi.fn(),
}));

vi.mock('../src/utils/http-cookies.js', () => ({
  setAuthSessionCookies: setAuthSessionCookiesMock,
  ensureCsrfCookie: vi.fn(),
  clearAuthSessionCookies: vi.fn(),
}));

import {
  googleAuthController,
  loginController,
  registerController,
} from '../src/controllers/auth.controller.js';

type MutableResponse = Response & {
  body?: unknown;
  statusCode?: number;
};

function createMockResponse(): MutableResponse {
  const response = {
    status: vi.fn((code: number) => {
      response.statusCode = code;
      return response as Response;
    }),
    json: vi.fn((payload: unknown) => {
      response.body = payload;
      return response as Response;
    }),
  } as MutableResponse;

  return response;
}

function createMockNext(): NextFunction {
  return vi.fn();
}

describe('auth controllers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('registerController returns user and token and sets cookies', async () => {
    const req = {
      body: {
        name: 'User One',
        email: 'user.one@example.com',
        password: 'Str0ngPass!123',
      },
    } as Request;
    const res = createMockResponse();
    const next = createMockNext();

    registerMock.mockResolvedValue({
      token: 'jwt.register.token',
      user: {
        id: 'user-1',
        name: 'User One',
        email: 'user.one@example.com',
        role: 'USER',
        defaultCurrency: 'EUR',
        avatarUrl: null,
        createdAt: new Date('2026-03-12T00:00:00.000Z'),
        updatedAt: new Date('2026-03-12T00:00:00.000Z'),
      },
    });

    await registerController(req, res, next);

    expect(registerMock).toHaveBeenCalledTimes(1);
    expect(setAuthSessionCookiesMock).toHaveBeenCalledWith(res, 'jwt.register.token');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'jwt.register.token',
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('loginController returns user and token and sets cookies', async () => {
    const req = {
      body: {
        email: 'user.one@example.com',
        password: 'Str0ngPass!123',
      },
    } as Request;
    const res = createMockResponse();
    const next = createMockNext();

    loginMock.mockResolvedValue({
      token: 'jwt.login.token',
      user: {
        id: 'user-1',
        name: 'User One',
        email: 'user.one@example.com',
        role: 'USER',
        defaultCurrency: 'EUR',
        avatarUrl: null,
        createdAt: new Date('2026-03-12T00:00:00.000Z'),
        updatedAt: new Date('2026-03-12T00:00:00.000Z'),
      },
    });

    await loginController(req, res, next);

    expect(loginMock).toHaveBeenCalledTimes(1);
    expect(setAuthSessionCookiesMock).toHaveBeenCalledWith(res, 'jwt.login.token');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'jwt.login.token',
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('googleAuthController returns user and token and sets cookies', async () => {
    const req = {
      body: {
        credential: 'google.jwt.credential',
      },
    } as Request;
    const res = createMockResponse();
    const next = createMockNext();

    loginWithGoogleMock.mockResolvedValue({
      token: 'jwt.google.token',
      user: {
        id: 'user-2',
        name: 'Google User',
        email: 'google.user@example.com',
        role: 'USER',
        defaultCurrency: 'EUR',
        avatarUrl: null,
        createdAt: new Date('2026-03-12T00:00:00.000Z'),
        updatedAt: new Date('2026-03-12T00:00:00.000Z'),
      },
    });

    await googleAuthController(req, res, next);

    expect(loginWithGoogleMock).toHaveBeenCalledTimes(1);
    expect(setAuthSessionCookiesMock).toHaveBeenCalledWith(res, 'jwt.google.token');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'jwt.google.token',
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });
});
