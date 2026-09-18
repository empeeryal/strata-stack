import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { securityHeaders, toHeadersFile } from './security-headers';

describe('security headers', () => {
  it('keeps public/_headers in sync with the shared header map', async () => {
    const file = await readFile(new URL('../public/_headers', import.meta.url), 'utf8');
    expect(file.trim()).toBe(toHeadersFile(securityHeaders).trim());
  });

  it('defines the essential hardening headers', () => {
    expect(securityHeaders['X-Content-Type-Options']).toBe('nosniff');
    expect(securityHeaders['X-Frame-Options']).toBe('DENY');
    expect(securityHeaders['Strict-Transport-Security']).toMatch(/max-age=\d+/);
    expect(securityHeaders['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });
});
