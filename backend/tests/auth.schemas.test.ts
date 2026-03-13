import { describe, expect, test } from 'vitest';
import {
  loginBodySchema,
  registerBodySchema,
  verifyEmailConfirmBodySchema,
  verifyEmailRequestBodySchema,
} from '../src/validations/auth.schemas.js';

describe('auth validation schemas', () => {
  test('register schema applies default currency', () => {
    const parsed = registerBodySchema.parse({
      name: 'User One',
      email: 'user.one@example.com',
      password: 'Str0ngPass!123',
    });

    expect(parsed.defaultCurrency).toBe('EUR');
  });

  test('login schema normalizes email', () => {
    const parsed = loginBodySchema.parse({
      email: 'USER.ONE@EXAMPLE.COM',
      password: 'x',
    });

    expect(parsed.email).toBe('user.one@example.com');
  });

  test('verify-email request schema validates email', () => {
    const parsed = verifyEmailRequestBodySchema.parse({
      email: 'USER.ONE@EXAMPLE.COM',
    });

    expect(parsed.email).toBe('user.one@example.com');
  });

  test('verify-email confirm schema requires token', () => {
    expect(() =>
      verifyEmailConfirmBodySchema.parse({
        token: '   ',
      }),
    ).toThrow();
  });
});
