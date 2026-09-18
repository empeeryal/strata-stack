/**
 * Canonical site URL resolution for `astro.config.ts`.
 *
 * Astro validates `site` strictly and aborts the build with a terse "Invalid URL" when the
 * value is empty or has no scheme, which is easy to hit when environment variables are added
 * to a hosting dashboard after the first deploy. This resolver:
 *
 * 1. prefers an explicit `SITE_URL`,
 * 2. falls back to the production URL the platform injects (Vercel's
 *    `VERCEL_PROJECT_PRODUCTION_URL`, Netlify's `URL`),
 * 3. and finally uses `siteConfig.url`.
 *
 * Bare hostnames get `https://`, trailing slashes are removed, and unusable values are
 * skipped with a warning instead of failing the build.
 */

export interface ResolvedSiteUrl {
  url: string;
  /** Environment variable that produced the URL, or `siteConfig.url`. */
  source: string;
}

/** Variables consulted in order. Platform variables carry the *production* host. */
const CANDIDATES = ['SITE_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'URL'] as const;

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/** Returns a normalised http(s) URL without a trailing slash, or `undefined` when unusable. */
export function normalizeSiteUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const candidate = HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (!URL.canParse(candidate)) return undefined;

  const url = new URL(candidate);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
  return url.href.replace(/\/+$/, '');
}

export function resolveSiteUrl(
  env: Record<string, string | undefined>,
  fallback: string,
  warn: (message: string) => void = (message) => console.warn(message),
): ResolvedSiteUrl {
  for (const name of CANDIDATES) {
    const raw = env[name];
    if (raw === undefined || raw.trim() === '') continue;

    const url = normalizeSiteUrl(raw);
    if (url) return { url, source: name };
    warn(`[site] Ignoring ${name}="${raw}" because it is not a valid URL.`);
  }

  const url = normalizeSiteUrl(fallback);
  if (!url) {
    throw new Error(`Invalid fallback site URL "${fallback}" in src/site.config.ts.`);
  }
  return { url, source: 'siteConfig.url' };
}
