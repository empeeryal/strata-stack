import { describe, expect, it, vi } from 'vitest';

import { normalizeSiteUrl, resolveSiteUrl } from './site-url';

const FALLBACK = 'https://fallback.example';

describe('resolveSiteUrl', () => {
  it('prefers a valid SITE_URL and strips trailing slashes', () => {
    expect(
      resolveSiteUrl(
        { SITE_URL: 'https://example.com/', VERCEL_PROJECT_PRODUCTION_URL: 'x.vercel.app' },
        FALLBACK,
      ),
    ).toEqual({ url: 'https://example.com', source: 'SITE_URL' });
  });

  it('adds https:// to bare hostnames', () => {
    expect(resolveSiteUrl({ SITE_URL: 'example.com' }, FALLBACK).url).toBe('https://example.com');
  });

  it('ignores an empty SITE_URL and uses the platform production URL', () => {
    expect(
      resolveSiteUrl(
        { SITE_URL: '', VERCEL_PROJECT_PRODUCTION_URL: 'my-site.vercel.app' },
        FALLBACK,
      ),
    ).toEqual({ url: 'https://my-site.vercel.app', source: 'VERCEL_PROJECT_PRODUCTION_URL' });

    expect(resolveSiteUrl({ URL: 'https://my-site.netlify.app/' }, FALLBACK)).toEqual({
      url: 'https://my-site.netlify.app',
      source: 'URL',
    });
  });

  it('skips invalid values with a warning instead of failing the build', () => {
    const warn = vi.fn();
    const result = resolveSiteUrl(
      { SITE_URL: 'http://', VERCEL_PROJECT_PRODUCTION_URL: 'my-site.vercel.app' },
      FALLBACK,
      warn,
    );
    expect(result).toEqual({
      url: 'https://my-site.vercel.app',
      source: 'VERCEL_PROJECT_PRODUCTION_URL',
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('SITE_URL'));
  });

  it('falls back to the configured site URL', () => {
    expect(resolveSiteUrl({}, FALLBACK)).toEqual({ url: FALLBACK, source: 'siteConfig.url' });
  });

  it('rejects an unusable fallback', () => {
    expect(() => resolveSiteUrl({}, 'http://')).toThrow(/Invalid fallback/);
  });
});

describe('normalizeSiteUrl', () => {
  it('trims, keeps a base path and drops trailing slashes', () => {
    expect(normalizeSiteUrl(' https://example.com/docs/ ')).toBe('https://example.com/docs');
    expect(normalizeSiteUrl('http://localhost:4321/')).toBe('http://localhost:4321');
  });

  it('returns undefined for empty or non-http values', () => {
    expect(normalizeSiteUrl(undefined)).toBeUndefined();
    expect(normalizeSiteUrl('   ')).toBeUndefined();
    expect(normalizeSiteUrl('ftp://example.com')).toBeUndefined();
    expect(normalizeSiteUrl('not a url')).toBeUndefined();
  });
});
