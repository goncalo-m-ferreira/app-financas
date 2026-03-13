import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
  bcryptCompareMock,
  bcryptHashMock,
  issueEmailVerificationForUserMock,
  prismaMock,
  txExpenseCategoryCreateManyMock,
  txUserCreateMock,
  txWalletCreateManyMock,
} = vi.hoisted(() => ({
  bcryptCompareMock: vi.fn(),
  bcryptHashMock: vi.fn(),
  issueEmailVerificationForUserMock: vi.fn(),
  txUserCreateMock: vi.fn(),
  txExpenseCategoryCreateManyMock: vi.fn(),
  txWalletCreateManyMock: vi.fn(),
  prismaMock: {
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: bcryptHashMock,
    compare: bcryptCompareMock,
  },
}));

vi.mock('google-auth-library', () => ({
  OAuth2Client: class OAuth2Client {
    verifyIdToken = vi.fn();
  },
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: prismaMock,
}));

vi.mock('../src/services/email-verification.service.js', () => ({
  assertEmailVerificationDeliveryConfigured: vi.fn(),
  issueEmailVerificationForUser: issueEmailVerificationForUserMock,
  requestEmailVerificationByEmail: vi.fn(),
  confirmEmailVerificationToken: vi.fn(),
}));

import { login, register } from '../src/services/auth.service.js';

describe('auth service', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        user: {
          create: txUserCreateMock,
        },
        expenseCategory: {
          createMany: txExpenseCategoryCreateManyMock,
        },
        wallet: {
          createMany: txWalletCreateManyMock,
        },
      }),
    );
  });

  test('login blocks password account when email is not verified', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'User One',
      email: 'user.one@example.com',
      emailVerifiedAt: null,
      passwordHash: 'hashed-password',
      googleId: null,
      avatarUrl: null,
      defaultCurrency: 'EUR',
      role: 'USER',
      createdAt: new Date('2026-03-12T00:00:00.000Z'),
      updatedAt: new Date('2026-03-12T00:00:00.000Z'),
    });

    await expect(
      login({
        email: 'user.one@example.com',
        password: 'Str0ngPass!123',
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      details: {
        code: 'EMAIL_NOT_VERIFIED',
      },
    });

    expect(bcryptCompareMock).not.toHaveBeenCalled();
  });

  test('login succeeds when email is verified and credentials are valid', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'User One',
      email: 'user.one@example.com',
      emailVerifiedAt: new Date('2026-03-12T10:00:00.000Z'),
      passwordHash: 'hashed-password',
      googleId: null,
      avatarUrl: null,
      defaultCurrency: 'EUR',
      role: 'USER',
      createdAt: new Date('2026-03-12T00:00:00.000Z'),
      updatedAt: new Date('2026-03-12T00:00:00.000Z'),
    });
    bcryptCompareMock.mockResolvedValue(true);

    const result = await login({
      email: 'user.one@example.com',
      password: 'Str0ngPass!123',
    });

    expect(result.user.email).toBe('user.one@example.com');
    expect(typeof result.token).toBe('string');
    expect(result.token.length).toBeGreaterThan(10);
  });

  test('register creates unverified account and triggers email verification delivery', async () => {
    bcryptHashMock.mockResolvedValue('hashed-password');
    txUserCreateMock.mockResolvedValue({
      id: 'user-1',
      name: 'User One',
      email: 'user.one@example.com',
      emailVerifiedAt: null,
      passwordHash: 'hashed-password',
      googleId: null,
      avatarUrl: null,
      defaultCurrency: 'EUR',
      role: 'USER',
      createdAt: new Date('2026-03-12T00:00:00.000Z'),
      updatedAt: new Date('2026-03-12T00:00:00.000Z'),
    });

    const result = await register({
      name: 'User One',
      email: 'user.one@example.com',
      password: 'Str0ngPass!123',
    });

    expect(result.requiresEmailVerification).toBe(true);
    expect(result.user.email).toBe('user.one@example.com');
    expect(issueEmailVerificationForUserMock).toHaveBeenCalledWith({
      userId: 'user-1',
      email: 'user.one@example.com',
      name: 'User One',
    });
  });
});
