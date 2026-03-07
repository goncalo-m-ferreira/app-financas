import { describe, expect, test } from 'vitest';
import type { RecurringScheduleConfig } from '../src/utils/recurring-schedule.js';
import {
  deriveAnchorsFromStartAt,
  listUpcomingOccurrences,
  resolveNextRunAt,
} from '../src/utils/recurring-schedule.js';

function toIsoDates(dates: Date[]): string[] {
  return dates.map((value) => value.toISOString());
}

function buildConfig(
  overrides: Partial<RecurringScheduleConfig>,
  baseStartAt = new Date('2025-01-31T10:00:00.000Z'),
): RecurringScheduleConfig {
  const anchors = deriveAnchorsFromStartAt({
    startAt: baseStartAt,
    timezone: 'UTC',
    frequency: 'MONTHLY',
  });

  return {
    frequency: 'MONTHLY',
    timezone: 'UTC',
    startAt: baseStartAt,
    anchorDayOfMonth: anchors.anchorDayOfMonth,
    anchorWeekday: anchors.anchorWeekday,
    anchorMonthOfYear: anchors.anchorMonthOfYear,
    anchorMinuteOfDay: anchors.anchorMinuteOfDay,
    isLastDayAnchor: anchors.isLastDayAnchor,
    endMode: 'NONE',
    endAt: null,
    maxOccurrences: null,
    occurrencesGenerated: 0,
    ...overrides,
  };
}

describe('recurring-schedule', () => {
  test('MONTHLY Jan 31 fallbacks to Feb last day and returns to Mar 31', () => {
    const config = buildConfig({
      frequency: 'MONTHLY',
      timezone: 'UTC',
      startAt: new Date('2025-01-31T10:00:00.000Z'),
      anchorDayOfMonth: 31,
      anchorWeekday: null,
      anchorMonthOfYear: null,
      anchorMinuteOfDay: 10 * 60,
      isLastDayAnchor: false,
    });

    const occurrences = listUpcomingOccurrences(config, {
      fromDate: new Date('2025-01-31T10:00:00.000Z'),
      count: 3,
    });

    expect(toIsoDates(occurrences)).toEqual([
      '2025-01-31T10:00:00.000Z',
      '2025-02-28T10:00:00.000Z',
      '2025-03-31T10:00:00.000Z',
    ]);
  });

  test('isLastDayAnchor preserves explicit end-of-month behavior', () => {
    const config = buildConfig({
      frequency: 'MONTHLY',
      timezone: 'UTC',
      startAt: new Date('2025-04-30T10:00:00.000Z'),
      anchorDayOfMonth: 30,
      anchorWeekday: null,
      anchorMonthOfYear: null,
      anchorMinuteOfDay: 10 * 60,
      isLastDayAnchor: true,
    });

    const occurrences = listUpcomingOccurrences(config, {
      fromDate: new Date('2025-04-30T10:00:00.000Z'),
      count: 3,
    });

    expect(toIsoDates(occurrences)).toEqual([
      '2025-04-30T10:00:00.000Z',
      '2025-05-31T10:00:00.000Z',
      '2025-06-30T10:00:00.000Z',
    ]);
  });

  test('YEARLY Feb 29 fallback uses Feb 28 on non-leap years and returns to Feb 29', () => {
    const config = buildConfig({
      frequency: 'YEARLY',
      timezone: 'UTC',
      startAt: new Date('2024-02-29T12:00:00.000Z'),
      anchorDayOfMonth: 29,
      anchorWeekday: null,
      anchorMonthOfYear: 2,
      anchorMinuteOfDay: 12 * 60,
      isLastDayAnchor: true,
    });

    const occurrences = listUpcomingOccurrences(config, {
      fromDate: new Date('2024-02-29T12:00:00.000Z'),
      count: 5,
    });

    expect(toIsoDates(occurrences)).toEqual([
      '2024-02-29T12:00:00.000Z',
      '2025-02-28T12:00:00.000Z',
      '2026-02-28T12:00:00.000Z',
      '2027-02-28T12:00:00.000Z',
      '2028-02-29T12:00:00.000Z',
    ]);
  });

  test('DAILY in Europe/Lisbon handles spring-forward by moving to next valid local minute', () => {
    const startAt = new Date('2025-03-29T01:30:00.000Z');
    const config = buildConfig({
      frequency: 'DAILY',
      timezone: 'Europe/Lisbon',
      startAt,
      anchorDayOfMonth: null,
      anchorWeekday: null,
      anchorMonthOfYear: null,
      anchorMinuteOfDay: 90,
      isLastDayAnchor: false,
    });

    const occurrences = listUpcomingOccurrences(config, {
      fromDate: startAt,
      count: 3,
    });

    expect(toIsoDates(occurrences)).toEqual([
      '2025-03-29T01:30:00.000Z',
      '2025-03-30T01:00:00.000Z',
      '2025-03-31T00:30:00.000Z',
    ]);
  });

  test('DAILY in Europe/Lisbon uses first occurrence for ambiguous fall-back local time', () => {
    const startAt = new Date('2025-10-25T00:30:00.000Z');
    const config = buildConfig({
      frequency: 'DAILY',
      timezone: 'Europe/Lisbon',
      startAt,
      anchorDayOfMonth: null,
      anchorWeekday: null,
      anchorMonthOfYear: null,
      anchorMinuteOfDay: 90,
      isLastDayAnchor: false,
    });

    const occurrences = listUpcomingOccurrences(config, {
      fromDate: startAt,
      count: 3,
    });

    expect(toIsoDates(occurrences)).toEqual([
      '2025-10-25T00:30:00.000Z',
      '2025-10-26T00:30:00.000Z',
      '2025-10-27T01:30:00.000Z',
    ]);
  });

  test('UNTIL_DATE is inclusive when occurrence matches exactly', () => {
    const startAt = new Date('2026-01-01T10:00:00.000Z');
    const anchors = deriveAnchorsFromStartAt({
      startAt,
      timezone: 'UTC',
      frequency: 'WEEKLY',
    });
    const config = buildConfig({
      frequency: 'WEEKLY',
      timezone: 'UTC',
      startAt,
      anchorDayOfMonth: null,
      anchorWeekday: anchors.anchorWeekday,
      anchorMonthOfYear: null,
      anchorMinuteOfDay: 10 * 60,
      isLastDayAnchor: false,
      endMode: 'UNTIL_DATE',
      endAt: new Date('2026-01-08T10:00:00.000Z'),
    });

    const occurrences = listUpcomingOccurrences(config, {
      fromDate: startAt,
      count: 5,
    });

    expect(toIsoDates(occurrences)).toEqual([
      '2026-01-01T10:00:00.000Z',
      '2026-01-08T10:00:00.000Z',
    ]);
  });

  test('MAX_OCCURRENCES counts deterministically from first real occurrence', () => {
    const startAt = new Date('2026-01-15T10:00:00.000Z');
    const config = buildConfig({
      frequency: 'MONTHLY',
      timezone: 'UTC',
      startAt,
      anchorDayOfMonth: 15,
      anchorWeekday: null,
      anchorMonthOfYear: null,
      anchorMinuteOfDay: 10 * 60,
      isLastDayAnchor: false,
      endMode: 'MAX_OCCURRENCES',
      maxOccurrences: 3,
      occurrencesGenerated: 1,
    });

    const occurrences = listUpcomingOccurrences(config, {
      fromDate: new Date('2026-02-15T10:00:00.000Z'),
      count: 10,
    });

    expect(toIsoDates(occurrences)).toEqual([
      '2026-02-15T10:00:00.000Z',
      '2026-03-15T10:00:00.000Z',
    ]);
  });

  test('resolveNextRunAt with DAILY never returns a past occurrence for reference now', () => {
    const startAt = new Date('2025-03-29T01:30:00.000Z');
    const config = buildConfig({
      frequency: 'DAILY',
      timezone: 'Europe/Lisbon',
      startAt,
      anchorDayOfMonth: null,
      anchorWeekday: null,
      anchorMonthOfYear: null,
      anchorMinuteOfDay: 90,
      isLastDayAnchor: false,
    });
    const referenceDate = new Date('2025-03-31T09:00:00.000Z');

    const nextRunAt = resolveNextRunAt(config, referenceDate);

    expect(nextRunAt).not.toBeNull();
    expect(nextRunAt!.getTime()).toBeGreaterThanOrEqual(referenceDate.getTime());
  });
});
