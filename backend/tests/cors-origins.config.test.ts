import { describe, expect, test } from 'vitest';
import { buildAllowedCorsOrigins, isLocalhostOrigin } from '../src/config/cors-origins.js';

describe('buildAllowedCorsOrigins', () => {
  test('uses localhost defaults in development when env variables are empty', () => {
    const origins = buildAllowedCorsOrigins({
      nodeEnv: 'development',
    });

    expect(origins).toEqual(['http://localhost:5173', 'http://127.0.0.1:5173']);
  });

  test('does not include localhost defaults in production', () => {
    const origins = buildAllowedCorsOrigins({
      nodeEnv: 'production',
      frontendUrl: 'https://app-financas-frontend.vercel.app',
    });

    expect(origins).toEqual(['https://app-financas-frontend.vercel.app']);
    expect(origins).not.toContain('http://localhost:5173');
    expect(origins).not.toContain('http://127.0.0.1:5173');
  });

  test('normalizes, splits and de-duplicates origins from FRONTEND_URL/FRONTEND_URLS', () => {
    const origins = buildAllowedCorsOrigins({
      nodeEnv: 'production',
      frontendUrl: ' https://app.example.com/ ',
      frontendUrls: 'https://preview.example.com, https://app.example.com',
    });

    expect(origins).toEqual(['https://app.example.com', 'https://preview.example.com']);
  });

  test('detects localhost origins for production validation', () => {
    expect(isLocalhostOrigin('http://localhost:5173')).toBe(true);
    expect(isLocalhostOrigin('https://127.0.0.1:3000')).toBe(true);
    expect(isLocalhostOrigin('https://app-financas-frontend.vercel.app')).toBe(false);
  });
});
