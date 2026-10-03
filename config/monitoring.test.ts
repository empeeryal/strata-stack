import { describe, expect, it, vi } from 'vitest';

import { resolveSentryDsn, resolveSentryEnvironment, sentryIngestOrigin } from './monitoring';

describe('resolveSentryDsn', () => {
  it('returns the DSN when it is set and well formed', () => {
    expect(
      resolveSentryDsn({ PUBLIC_SENTRY_DSN: ' https://abc@o123.ingest.us.sentry.io/456 ' }),
    ).toBe('https://abc@o123.ingest.us.sentry.io/456');
  });

  it('keeps monitoring off without a DSN, for an empty value and for something that is not a URL', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveSentryDsn({})).toBeNull();
    expect(resolveSentryDsn({ PUBLIC_SENTRY_DSN: '' })).toBeNull();
    expect(resolveSentryDsn({ PUBLIC_SENTRY_DSN: '   ' })).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    expect(resolveSentryDsn({ PUBLIC_SENTRY_DSN: 'not a dsn' })).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe('sentryIngestOrigin', () => {
  it('derives the origin the browser SDK reports to', () => {
    expect(sentryIngestOrigin('https://abc@o123.ingest.us.sentry.io/456')).toBe(
      'https://o123.ingest.us.sentry.io',
    );
    expect(sentryIngestOrigin('https://key@sentry.example.com:8443/2')).toBe(
      'https://sentry.example.com:8443',
    );
  });
});

describe('resolveSentryEnvironment', () => {
  it('prefers the explicit name, then the platform, then production', () => {
    expect(
      resolveSentryEnvironment({ PUBLIC_SENTRY_ENVIRONMENT: 'staging', VERCEL_ENV: 'preview' }),
    ).toBe('staging');
    expect(resolveSentryEnvironment({ VERCEL_ENV: 'preview' })).toBe('preview');
    expect(resolveSentryEnvironment({ CONTEXT: 'deploy-preview' })).toBe('deploy-preview');
    expect(resolveSentryEnvironment({ PUBLIC_SENTRY_ENVIRONMENT: ' ' })).toBe('production');
    expect(resolveSentryEnvironment({})).toBe('production');
  });
});
