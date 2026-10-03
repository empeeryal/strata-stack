/**
 * Error monitoring (Sentry) is opt-in: it exists in a build only when `PUBLIC_SENTRY_DSN` is
 * set. These helpers read the DSN at build time, for `astro.config.ts`: whether to register the
 * integration at all, and which origin the browser SDK will talk to so the Content Security
 * Policy can allow it. Pure functions, no imports, so they are unit-tested in isolation.
 */

/** The Sentry DSN from the environment, or null when monitoring is off or the value is not a URL. */
export function resolveSentryDsn(env: Record<string, string | undefined>): string | null {
  const value = env.PUBLIC_SENTRY_DSN?.trim();
  if (!value) return null;
  if (!URL.canParse(value)) {
    console.warn(`[monitoring] PUBLIC_SENTRY_DSN is not a URL; monitoring stays off.`);
    return null;
  }
  return value;
}

/**
 * The origin the browser SDK sends events to, derived from the DSN
 * (`https://<key>@o123.ingest.us.sentry.io/456` → `https://o123.ingest.us.sentry.io`). It goes
 * into `connect-src`; without it the hash-based policy blocks every report.
 */
export function sentryIngestOrigin(dsn: string): string {
  return new URL(dsn).origin;
}

/**
 * The environment name reported with each event: an explicit `PUBLIC_SENTRY_ENVIRONMENT`, else
 * what the platform knows about the deployment (Vercel's `VERCEL_ENV`, Netlify's `CONTEXT`),
 * else `production`.
 */
export function resolveSentryEnvironment(env: Record<string, string | undefined>): string {
  const first = (...names: string[]) => names.map((name) => env[name]?.trim()).find(Boolean);
  return first('PUBLIC_SENTRY_ENVIRONMENT', 'VERCEL_ENV', 'CONTEXT') ?? 'production';
}
