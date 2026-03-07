import { describe, expect, test } from 'vitest';
import {
  createRecurringRuleBodySchema,
  updateRecurringRuleBodySchema,
} from '../src/validations/recurring-rules.schemas.js';

describe('recurring-rules validation schemas', () => {
  test('create schema accepts DAILY frequency', () => {
    const parsed = createRecurringRuleBodySchema.parse({
      type: 'EXPENSE',
      amount: 49.9,
      walletId: '89fcedeb-dcab-4be0-b7d3-34c6f376e2cd',
      categoryId: '77e245b6-57ce-45a1-96be-74ea8d65fab9',
      timezone: 'Europe/Lisbon',
      frequency: 'DAILY',
      startAt: '2026-01-01T10:00:00.000Z',
      endMode: 'NONE',
    });

    expect(parsed.frequency).toBe('DAILY');
  });

  test('PATCH rejects forbidden/unknown fields', () => {
    expect(() =>
      updateRecurringRuleBodySchema.parse({
        status: 'ACTIVE',
      }),
    ).toThrow();
  });

  test('PATCH rejects empty payload', () => {
    expect(() => updateRecurringRuleBodySchema.parse({})).toThrow();
  });
});
