export function getDefaultDateTimeLocal(): string {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60 * 1000);
  return date.toISOString().slice(0, 16);
}

export function isoToDateTimeLocal(value: string | null): string {
  if (!value) {
    return '';
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return '';
  }

  const localDate = new Date(parsedDate.getTime() - parsedDate.getTimezoneOffset() * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

export function dateTimeLocalToIso(value: string): string | null {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString();
}

export function formatRecurringDateTime(value: string | null, timezone: string): string {
  if (!value) {
    return '-';
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return '-';
  }

  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    }).format(parsedDate);
  } catch {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(parsedDate);
  }
}
