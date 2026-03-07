import { describe, expect, test } from 'vitest';
import {
  adminOverviewQuerySchema,
  adminRecurringOperationsQuerySchema,
} from '../src/validations/admin.schemas.js';

describe('admin validation schemas', () => {
  test('admin overview query keeps default take=20', () => {
    const parsed = adminOverviewQuerySchema.parse({});

    expect(parsed.take).toBe(20);
  });

  test('admin recurring operations query keeps default take=50', () => {
    const parsed = adminRecurringOperationsQuerySchema.parse({});

    expect(parsed.take).toBe(50);
    expect(parsed.issueType).toBeUndefined();
  });

  test('admin recurring operations query validates issueType', () => {
    const parsed = adminRecurringOperationsQuerySchema.parse({
      issueType: 'FAILED_EXECUTION',
      take: '10',
    });

    expect(parsed.issueType).toBe('FAILED_EXECUTION');
    expect(parsed.take).toBe(10);
  });

  test('admin recurring operations query rejects take > 100', () => {
    expect(() =>
      adminRecurringOperationsQuerySchema.parse({
        take: '101',
      }),
    ).toThrow();
  });
});
