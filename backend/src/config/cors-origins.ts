type BuildAllowedCorsOriginsInput = {
  nodeEnv: string;
  frontendUrl?: string;
  frontendUrls?: string;
};

const LOCAL_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

export function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function parseOriginsFromValue(value: string | undefined): string[] {
  if (!value || value.trim().length === 0) {
    return [];
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => normalizeOrigin(entry));
}

export function buildAllowedCorsOrigins(input: BuildAllowedCorsOriginsInput): string[] {
  const configuredOrigins = [
    ...parseOriginsFromValue(input.frontendUrl),
    ...parseOriginsFromValue(input.frontendUrls),
  ];
  const defaultOrigins = input.nodeEnv === 'production' ? [] : LOCAL_ORIGINS;

  return Array.from(new Set([...configuredOrigins, ...defaultOrigins]));
}

export function isLocalhostOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}
