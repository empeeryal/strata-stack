/**
 * Server-side environment access.
 *
 * These helpers read `process.env` on purpose (instead of `astro:env/server`):
 * - the Better Auth CLI loads `src/lib/auth.ts` outside of Astro,
 * - Node scripts import the database client directly,
 * - Cloudflare Workers expose variables through `process.env` when `nodejs_compat`
 *   is enabled with a compatibility date of 2025-04-01 or later (see wrangler.jsonc).
 *
 * Keep this file free of Astro virtual imports and path aliases.
 */

export function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value === '' ? undefined : value;
}

export function requireEnv(name: string): string {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable "${name}". See .env.example.`);
  }
  return value;
}

export const isProduction = process.env.NODE_ENV === 'production';

/** Public origin visitors use, e.g. https://example.com. */
export function getSiteUrl(): string {
  const explicit = getEnv('BETTER_AUTH_URL') ?? getEnv('SITE_URL');
  if (explicit) return explicit.replace(/\/+$/, '');

  // Platform-provided hosts (no protocol).
  const vercel = getEnv('VERCEL_PROJECT_PRODUCTION_URL') ?? getEnv('VERCEL_URL');
  if (vercel) return `https://${vercel}`;
  const netlify = getEnv('URL') ?? getEnv('DEPLOY_PRIME_URL');
  if (netlify) return netlify.replace(/\/+$/, '');

  return 'http://localhost:4321';
}

/**
 * Origins allowed to call the auth API. Includes explicit configuration plus the
 * preview URLs each platform injects, so preview deployments can sign in.
 */
export function getTrustedOrigins(): string[] {
  const origins = new Set<string>([getSiteUrl()]);

  for (const entry of (getEnv('BETTER_AUTH_TRUSTED_ORIGINS') ?? '').split(',')) {
    const origin = entry.trim();
    if (origin) origins.add(origin);
  }

  for (const host of [
    getEnv('VERCEL_URL'),
    getEnv('VERCEL_BRANCH_URL'),
    getEnv('VERCEL_PROJECT_PRODUCTION_URL'),
  ]) {
    if (host) origins.add(`https://${host}`);
  }
  for (const url of [getEnv('URL'), getEnv('DEPLOY_PRIME_URL'), getEnv('DEPLOY_URL')]) {
    if (url) origins.add(url.replace(/\/+$/, ''));
  }

  if (!isProduction) {
    origins.add('http://localhost:4321');
    origins.add('http://127.0.0.1:4321');
  }

  return [...origins];
}
