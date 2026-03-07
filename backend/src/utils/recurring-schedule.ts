import { RecurringEndMode, RecurringFrequency } from '@prisma/client';
import { DateTime, IANAZone } from 'luxon';
import { AppError } from '../errors/app-error.js';

const MINUTES_IN_DAY = 24 * 60;
const MAX_INVALID_TIME_FORWARD_SHIFT_MINUTES = 180;
const MAX_AMBIGUOUS_TIME_BACK_SHIFT_MINUTES = 180;
const OCCURRENCE_GUARD_LIMIT = 5000;

export type RecurringScheduleAnchors = {
  anchorDayOfMonth: number | null;
  anchorWeekday: number | null;
  anchorMonthOfYear: number | null;
  anchorMinuteOfDay: number;
  isLastDayAnchor: boolean;
};

export type RecurringScheduleConfig = RecurringScheduleAnchors & {
  frequency: RecurringFrequency;
  timezone: string;
  startAt: Date;
  endMode: RecurringEndMode;
  endAt: Date | null;
  maxOccurrences: number | null;
  occurrencesGenerated: number;
};

export type UpcomingOccurrencesInput = {
  count: number;
  fromDate: Date;
};

function toLocalDateTime(date: Date, timezone: string): DateTime {
  return DateTime.fromJSDate(date, { zone: 'utc' }).setZone(timezone);
}

function assertValidAnchorMinuteOrThrow(anchorMinuteOfDay: number): void {
  if (!Number.isInteger(anchorMinuteOfDay) || anchorMinuteOfDay < 0 || anchorMinuteOfDay >= MINUTES_IN_DAY) {
    throw new AppError('anchorMinuteOfDay inválido.', 400);
  }
}

function assertTimezoneOrThrow(timezone: string): void {
  if (!IANAZone.isValidZone(timezone)) {
    throw new AppError('Timezone inválido. Use uma timezone IANA válida.', 400);
  }
}

function assertScheduleConfigOrThrow(config: RecurringScheduleConfig): void {
  assertTimezoneOrThrow(config.timezone);
  assertValidAnchorMinuteOrThrow(config.anchorMinuteOfDay);

  if (config.frequency === 'WEEKLY' && !config.anchorWeekday) {
    throw new AppError('anchorWeekday é obrigatório para frequência WEEKLY.', 400);
  }

  if ((config.frequency === 'MONTHLY' || config.frequency === 'YEARLY') && !config.anchorDayOfMonth) {
    throw new AppError('anchorDayOfMonth é obrigatório para frequência MONTHLY/YEARLY.', 400);
  }

  if (config.frequency === 'YEARLY' && !config.anchorMonthOfYear) {
    throw new AppError('anchorMonthOfYear é obrigatório para frequência YEARLY.', 400);
  }
}

function daysInMonth(year: number, month: number, timezone: string): number {
  const reference = DateTime.fromObject({ year, month, day: 1, hour: 12 }, { zone: timezone });

  if (!reference.isValid || !reference.daysInMonth) {
    throw new AppError('Falha ao resolver os dias do mês para recorrência.', 400);
  }

  return reference.daysInMonth;
}

function isExactLocalMatch(
  candidate: DateTime,
  params: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
  },
): boolean {
  return (
    candidate.isValid &&
    candidate.year === params.year &&
    candidate.month === params.month &&
    candidate.day === params.day &&
    candidate.hour === params.hour &&
    candidate.minute === params.minute
  );
}

function resolveAmbiguousToFirstOccurrence(
  candidate: DateTime,
  params: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
  },
): DateTime {
  let earliest = candidate;

  /**
   * Política explícita de DST fall-back:
   * se a mesma hora local existir duas vezes, escolhemos a primeira ocorrência.
   * O Luxon tende a resolver para a ocorrência posterior; por isso caminhamos para trás
   * no tempo absoluto e escolhemos o primeiro instante que mantém o mesmo wall-clock local.
   */
  for (let shift = 1; shift <= MAX_AMBIGUOUS_TIME_BACK_SHIFT_MINUTES; shift += 1) {
    const previous = candidate.minus({ minutes: shift });

    if (isExactLocalMatch(previous, params)) {
      earliest = previous;
      continue;
    }

    if (earliest.toMillis() < candidate.toMillis()) {
      break;
    }
  }

  return earliest.set({ second: 0, millisecond: 0 });
}

function buildLocalDateTime(params: {
  timezone: string;
  year: number;
  month: number;
  day: number;
  anchorMinuteOfDay: number;
}): DateTime {
  const hour = Math.floor(params.anchorMinuteOfDay / 60);
  const minute = params.anchorMinuteOfDay % 60;

  const exactCandidate = DateTime.fromObject(
    {
      year: params.year,
      month: params.month,
      day: params.day,
      hour,
      minute,
      second: 0,
      millisecond: 0,
    },
    { zone: params.timezone },
  );

  if (
    isExactLocalMatch(exactCandidate, {
      year: params.year,
      month: params.month,
      day: params.day,
      hour,
      minute,
    })
  ) {
    return resolveAmbiguousToFirstOccurrence(exactCandidate, {
      year: params.year,
      month: params.month,
      day: params.day,
      hour,
      minute,
    });
  }

  /**
   * Política explícita de DST spring-forward:
   * se a hora local não existir, avançamos minuto a minuto no relógio local
   * até ao próximo minuto válido no mesmo dia (janela limitada).
   */
  for (let offset = 1; offset <= MAX_INVALID_TIME_FORWARD_SHIFT_MINUTES; offset += 1) {
    const minuteOfDay = params.anchorMinuteOfDay + offset;

    if (minuteOfDay >= MINUTES_IN_DAY) {
      break;
    }

    const candidateHour = Math.floor(minuteOfDay / 60);
    const candidateMinute = minuteOfDay % 60;
    const candidate = DateTime.fromObject(
      {
        year: params.year,
        month: params.month,
        day: params.day,
        hour: candidateHour,
        minute: candidateMinute,
        second: 0,
        millisecond: 0,
      },
      { zone: params.timezone },
    );

    if (
      isExactLocalMatch(candidate, {
        year: params.year,
        month: params.month,
        day: params.day,
        hour: candidateHour,
        minute: candidateMinute,
      })
    ) {
      return candidate.set({ second: 0, millisecond: 0 });
    }
  }

  throw new AppError('Não foi possível resolver uma hora local válida para a recorrência.', 400);
}

function resolveMonthlyDay(config: RecurringScheduleConfig, year: number, month: number): number {
  const lastDay = daysInMonth(year, month, config.timezone);

  if (config.isLastDayAnchor) {
    return lastDay;
  }

  /**
   * Política determinística para MONTHLY/YEARLY:
   * quando o dia âncora não existe no mês alvo, usamos o último dia.
   * Ex.: Jan 31 -> Fev 28/29 e volta a 31 quando existir; Feb 29 yearly -> Feb 28 em não bissexto.
   */
  const anchorDayOfMonth = config.anchorDayOfMonth ?? lastDay;
  return Math.min(anchorDayOfMonth, lastDay);
}

function computeDailyOccurrenceOnOrAfter(
  config: RecurringScheduleConfig,
  fromLocal: DateTime,
): DateTime {
  let candidate = buildLocalDateTime({
    timezone: config.timezone,
    year: fromLocal.year,
    month: fromLocal.month,
    day: fromLocal.day,
    anchorMinuteOfDay: config.anchorMinuteOfDay,
  });

  if (candidate.toMillis() < fromLocal.toMillis()) {
    const nextDay = fromLocal.startOf('day').plus({ days: 1 });
    candidate = buildLocalDateTime({
      timezone: config.timezone,
      year: nextDay.year,
      month: nextDay.month,
      day: nextDay.day,
      anchorMinuteOfDay: config.anchorMinuteOfDay,
    });
  }

  return candidate;
}

function computeWeeklyOccurrenceOnOrAfter(
  config: RecurringScheduleConfig,
  fromLocal: DateTime,
): DateTime {
  const anchorWeekday = config.anchorWeekday ?? fromLocal.weekday;
  const weekdayDelta = anchorWeekday - fromLocal.weekday;
  const candidateDate = fromLocal.startOf('day').plus({ days: weekdayDelta });

  let candidate = buildLocalDateTime({
    timezone: config.timezone,
    year: candidateDate.year,
    month: candidateDate.month,
    day: candidateDate.day,
    anchorMinuteOfDay: config.anchorMinuteOfDay,
  });

  if (candidate.toMillis() < fromLocal.toMillis()) {
    candidate = candidate.plus({ weeks: 1 });
  }

  return candidate;
}

function computeMonthlyOccurrenceOnOrAfter(
  config: RecurringScheduleConfig,
  fromLocal: DateTime,
): DateTime {
  const day = resolveMonthlyDay(config, fromLocal.year, fromLocal.month);

  let candidate = buildLocalDateTime({
    timezone: config.timezone,
    year: fromLocal.year,
    month: fromLocal.month,
    day,
    anchorMinuteOfDay: config.anchorMinuteOfDay,
  });

  if (candidate.toMillis() < fromLocal.toMillis()) {
    const nextMonth = fromLocal.startOf('month').plus({ months: 1 });
    const nextDay = resolveMonthlyDay(config, nextMonth.year, nextMonth.month);

    candidate = buildLocalDateTime({
      timezone: config.timezone,
      year: nextMonth.year,
      month: nextMonth.month,
      day: nextDay,
      anchorMinuteOfDay: config.anchorMinuteOfDay,
    });
  }

  return candidate;
}

function computeYearlyOccurrenceOnOrAfter(
  config: RecurringScheduleConfig,
  fromLocal: DateTime,
): DateTime {
  const anchorMonthOfYear = config.anchorMonthOfYear ?? fromLocal.month;
  const day = resolveMonthlyDay(config, fromLocal.year, anchorMonthOfYear);

  let candidate = buildLocalDateTime({
    timezone: config.timezone,
    year: fromLocal.year,
    month: anchorMonthOfYear,
    day,
    anchorMinuteOfDay: config.anchorMinuteOfDay,
  });

  if (candidate.toMillis() < fromLocal.toMillis()) {
    const nextYear = fromLocal.year + 1;
    const nextDay = resolveMonthlyDay(config, nextYear, anchorMonthOfYear);

    candidate = buildLocalDateTime({
      timezone: config.timezone,
      year: nextYear,
      month: anchorMonthOfYear,
      day: nextDay,
      anchorMinuteOfDay: config.anchorMinuteOfDay,
    });
  }

  return candidate;
}

function computeOccurrenceOnOrAfter(config: RecurringScheduleConfig, fromLocal: DateTime): DateTime {
  if (config.frequency === 'DAILY') {
    return computeDailyOccurrenceOnOrAfter(config, fromLocal);
  }

  if (config.frequency === 'WEEKLY') {
    return computeWeeklyOccurrenceOnOrAfter(config, fromLocal);
  }

  if (config.frequency === 'MONTHLY') {
    return computeMonthlyOccurrenceOnOrAfter(config, fromLocal);
  }

  return computeYearlyOccurrenceOnOrAfter(config, fromLocal);
}

function computeOccurrenceAfter(config: RecurringScheduleConfig, previousLocal: DateTime): DateTime {
  if (config.frequency === 'DAILY') {
    const nextDay = previousLocal.startOf('day').plus({ days: 1 });

    return buildLocalDateTime({
      timezone: config.timezone,
      year: nextDay.year,
      month: nextDay.month,
      day: nextDay.day,
      anchorMinuteOfDay: config.anchorMinuteOfDay,
    });
  }

  if (config.frequency === 'WEEKLY') {
    const candidateDate = previousLocal.startOf('day').plus({ weeks: 1 });

    return buildLocalDateTime({
      timezone: config.timezone,
      year: candidateDate.year,
      month: candidateDate.month,
      day: candidateDate.day,
      anchorMinuteOfDay: config.anchorMinuteOfDay,
    });
  }

  if (config.frequency === 'MONTHLY') {
    const nextMonth = previousLocal.startOf('month').plus({ months: 1 });
    const day = resolveMonthlyDay(config, nextMonth.year, nextMonth.month);

    return buildLocalDateTime({
      timezone: config.timezone,
      year: nextMonth.year,
      month: nextMonth.month,
      day,
      anchorMinuteOfDay: config.anchorMinuteOfDay,
    });
  }

  const nextYear = previousLocal.year + 1;
  const anchorMonth = config.anchorMonthOfYear ?? previousLocal.month;
  const day = resolveMonthlyDay(config, nextYear, anchorMonth);

  return buildLocalDateTime({
    timezone: config.timezone,
    year: nextYear,
    month: anchorMonth,
    day,
    anchorMinuteOfDay: config.anchorMinuteOfDay,
  });
}

function isOccurrenceAllowed(
  config: RecurringScheduleConfig,
  occurrenceUtc: Date,
  occurrenceNumber: number,
): boolean {
  if (config.endMode === 'MAX_OCCURRENCES') {
    const maxOccurrences = config.maxOccurrences ?? 0;
    return occurrenceNumber <= maxOccurrences;
  }

  if (config.endMode === 'UNTIL_DATE') {
    if (!config.endAt) {
      return false;
    }

    return occurrenceUtc.getTime() <= config.endAt.getTime();
  }

  return true;
}

export function deriveAnchorsFromStartAt(params: {
  startAt: Date;
  timezone: string;
  frequency: RecurringFrequency;
}): RecurringScheduleAnchors {
  assertTimezoneOrThrow(params.timezone);

  const localStart = toLocalDateTime(params.startAt, params.timezone);

  if (!localStart.isValid) {
    throw new AppError('startAt inválido para a timezone informada.', 400);
  }

  const anchorMinuteOfDay = localStart.hour * 60 + localStart.minute;
  const isLastDayAnchor =
    params.frequency !== 'WEEKLY' && localStart.day === localStart.endOf('month').day;

  if (params.frequency === 'DAILY' || params.frequency === 'WEEKLY') {
    return {
      anchorDayOfMonth: null,
      anchorWeekday: params.frequency === 'WEEKLY' ? localStart.weekday : null,
      anchorMonthOfYear: null,
      anchorMinuteOfDay,
      isLastDayAnchor: false,
    };
  }

  if (params.frequency === 'MONTHLY') {
    return {
      anchorDayOfMonth: localStart.day,
      anchorWeekday: null,
      anchorMonthOfYear: null,
      anchorMinuteOfDay,
      isLastDayAnchor,
    };
  }

  return {
    anchorDayOfMonth: localStart.day,
    anchorWeekday: null,
    anchorMonthOfYear: localStart.month,
    anchorMinuteOfDay,
    isLastDayAnchor,
  };
}

export function resolveNextRunAt(config: RecurringScheduleConfig, referenceDate: Date): Date | null {
  assertScheduleConfigOrThrow(config);

  const startLocal = toLocalDateTime(config.startAt, config.timezone);
  const referenceLocal = toLocalDateTime(referenceDate, config.timezone);
  const fromLocal =
    referenceLocal.toMillis() < startLocal.toMillis() ? startLocal : referenceLocal;

  const candidateLocal = computeOccurrenceOnOrAfter(config, fromLocal);
  const candidateUtc = candidateLocal.toUTC().toJSDate();
  const nextOccurrenceNumber = config.occurrencesGenerated + 1;

  if (!isOccurrenceAllowed(config, candidateUtc, nextOccurrenceNumber)) {
    return null;
  }

  return candidateUtc;
}

export function listUpcomingOccurrences(
  config: RecurringScheduleConfig,
  input: UpcomingOccurrencesInput,
): Date[] {
  assertScheduleConfigOrThrow(config);

  const count = Number.isInteger(input.count) ? Math.max(1, input.count) : 1;
  const fromLocal = toLocalDateTime(input.fromDate, config.timezone);
  const startLocal = toLocalDateTime(config.startAt, config.timezone);
  const localReference = fromLocal.toMillis() < startLocal.toMillis() ? startLocal : fromLocal;

  let candidateLocal = computeOccurrenceOnOrAfter(config, localReference);
  let occurrenceOffset = 0;
  const occurrences: Date[] = [];

  while (occurrences.length < count && occurrenceOffset < OCCURRENCE_GUARD_LIMIT) {
    const occurrenceUtc = candidateLocal.toUTC().toJSDate();
    const occurrenceNumber = config.occurrencesGenerated + occurrenceOffset + 1;

    if (!isOccurrenceAllowed(config, occurrenceUtc, occurrenceNumber)) {
      break;
    }

    occurrences.push(occurrenceUtc);
    candidateLocal = computeOccurrenceAfter(config, candidateLocal);
    occurrenceOffset += 1;
  }

  return occurrences;
}
