import { randomBytes } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env.js';

const SAFE_COOKIE_PATH = '/';

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader || cookieHeader.trim().length === 0) {
    return {};
  }

  return cookieHeader.split(';').reduce<Record<string, string>>((accumulator, part) => {
    const [rawName, ...rawValueParts] = part.split('=');
    const name = rawName?.trim();

    if (!name) {
      return accumulator;
    }

    const rawValue = rawValueParts.join('=').trim();
    accumulator[name] = decodeURIComponent(rawValue);
    return accumulator;
  }, {});
}

function readCookie(req: Request, name: string): string | null {
  const cookies = parseCookieHeader(req.header('cookie'));
  return cookies[name] ?? null;
}

function buildBaseCookieOptions(): CookieOptions {
  const baseOptions: CookieOptions = {
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: SAFE_COOKIE_PATH,
  };

  if (env.cookieDomain) {
    baseOptions.domain = env.cookieDomain;
  }

  return baseOptions;
}

export function readAuthTokenCookie(req: Request): string | null {
  return readCookie(req, env.authCookieName);
}

export function readCsrfCookie(req: Request): string | null {
  return readCookie(req, env.csrfCookieName);
}

export function setAuthSessionCookies(res: Response, jwtToken: string): void {
  const baseOptions = buildBaseCookieOptions();
  const csrfToken = randomBytes(32).toString('hex');

  res.cookie(env.authCookieName, jwtToken, {
    ...baseOptions,
    httpOnly: true,
  });

  res.cookie(env.csrfCookieName, csrfToken, {
    ...baseOptions,
    httpOnly: false,
  });
}

export function ensureCsrfCookie(req: Request, res: Response): void {
  const existingToken = readCsrfCookie(req);

  if (existingToken) {
    return;
  }

  const baseOptions = buildBaseCookieOptions();
  const csrfToken = randomBytes(32).toString('hex');

  res.cookie(env.csrfCookieName, csrfToken, {
    ...baseOptions,
    httpOnly: false,
  });
}

export function clearAuthSessionCookies(res: Response): void {
  const baseOptions = buildBaseCookieOptions();

  res.clearCookie(env.authCookieName, {
    ...baseOptions,
    httpOnly: true,
  });

  res.clearCookie(env.csrfCookieName, {
    ...baseOptions,
    httpOnly: false,
  });
}
