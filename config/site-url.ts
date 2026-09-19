/**
 * Canonical site URL for `astro.config.ts`: an explicit `SITE_URL`, else the production URL
 * the platform injects (Vercel's `VERCEL_PROJECT_PRODUCTION_URL`, Netlify's `URL`), else
 * `siteConfig.url`. Bare hostnames get `https://`, trailing slashes are removed, and values
 * that are not http(s) URLs are skipped with a warning instead of failing the build.
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
