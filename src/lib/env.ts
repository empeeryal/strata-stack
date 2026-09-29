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

export const isProduction = process.env.NODE_ENV === 'production';

export interface DatabaseConfig {
  url: string;
  authToken: string | undefined;
}

/**
 * Database connection settings. `DATABASE_URL` and `DATABASE_AUTH_TOKEN` are the template's
 * names; `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`, which Turso's Vercel integration sets,
 * are accepted as well. Defaults to the local file database.
 */
export function getDatabaseConfig(
  env: Record<string, string | undefined> = process.env,
): DatabaseConfig {
  const pick = (...names: string[]) => names.map((name) => env[name]).find((value) => value);
  return {
    url: pick('DATABASE_URL', 'TURSO_DATABASE_URL') ?? 'file:./.data/local.db',
    authToken: pick('DATABASE_AUTH_TOKEN', 'TURSO_AUTH_TOKEN'),
  };
}

const stripSlash = (url: string) => url.replace(/\/+$/, '');

/** Values a copied .env.example or a test setup leaves in BETTER_AUTH_SECRET. */
const PLACEHOLDER_SECRET = /change-me|ci-only|e2e-only|example|placeholder/i;

/**
 * The public origin from explicit configuration or the platform's own variables, or null when
 * nothing is set (the caller decides on a fallback).
 */
export function resolvePublicUrl(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const explicit = env.BETTER_AUTH_URL ?? env.SITE_URL;
  if (explicit) return stripSlash(explicit);

  // Platform-provided hosts (no protocol).
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL ?? env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  const netlify = env.URL ?? env.DEPLOY_PRIME_URL;
  if (netlify) return stripSlash(netlify);

  return null;
}

/** Public origin visitors use, e.g. https://example.com; localhost during development. */
export function getSiteUrl(): string {
  return resolvePublicUrl() ?? 'http://localhost:4321';
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
    if (url) origins.add(stripSlash(url));
  }

  if (!isProduction) {
    origins.add('http://localhost:4321');
    origins.add('http://127.0.0.1:4321');
  }

  return [...origins];
}

/** Addresses that receive the `admin` role automatically when they sign up (ADMIN_EMAILS). */
export function getAdminEmails(env: Record<string, string | undefined> = process.env): string[] {
  return (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/** How long archived contact messages are kept before `pnpm db:prune` deletes them. */
export function getContactRetentionDays(
  env: Record<string, string | undefined> = process.env,
): number {
  const value = Number(env.CONTACT_RETENTION_DAYS ?? 365);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 365;
}

/**
 * Optional hard cap on message age (CONTACT_MAX_AGE_DAYS): `pnpm db:prune` deletes messages
 * older than this whatever their status. Unset by default, so open messages are kept.
 */
export function getContactMaxAgeDays(
  env: Record<string, string | undefined> = process.env,
): number | null {
  const raw = env.CONTACT_MAX_AGE_DAYS;
  if (raw === undefined || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

/**
 * How long unconfirmed newsletter requests and unsubscribed addresses are kept before
 * `pnpm db:prune` deletes them (NEWSLETTER_RETENTION_DAYS, default 7). Confirmed subscribers
 * are never pruned.
 */
export function getNewsletterRetentionDays(
  env: Record<string, string | undefined> = process.env,
): number {
  const value = Number(env.NEWSLETTER_RETENTION_DAYS ?? 7);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 7;
}

export interface ConfigIssue {
  level: 'error' | 'warn';
  message: string;
}

/**
 * Checks the settings that make a production deployment safe. Errors describe states in
 * which the app must not serve requests (an unset or weak auth secret); warnings describe
 * features that silently degrade (no email provider, no contact recipient).
 */
export function checkProductionConfig(
  env: Record<string, string | undefined> = process.env,
): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  if (env.NODE_ENV !== 'production') return issues;

  const secret = env.BETTER_AUTH_SECRET;
  if (!secret) {
    issues.push({
      level: 'error',
      message: 'BETTER_AUTH_SECRET is not set. Generate one with `openssl rand -base64 32`.',
    });
  } else if (secret.length < 32) {
    issues.push({
      level: 'error',
      message: 'BETTER_AUTH_SECRET must be at least 32 characters long.',
    });
  } else if (PLACEHOLDER_SECRET.test(secret)) {
    // The value from .env.example or a test setup is long enough but publicly known.
    issues.push({
      level: 'error',
      message:
        'BETTER_AUTH_SECRET is a placeholder from .env.example or the test setup. Generate a real one with `openssl rand -base64 32`.',
    });
  }

  // Without a public URL Better Auth falls back to http://localhost:4321: cookies lose their
  // Secure flag, every origin-checked request fails and emails link to localhost.
  const publicUrl = resolvePublicUrl(env);
  if (!publicUrl) {
    issues.push({
      level: 'error',
      message:
        'No public URL is configured. Set BETTER_AUTH_URL (or SITE_URL) to the https address visitors use, e.g. https://example.com.',
    });
  } else if (!publicUrl.startsWith('https://')) {
    issues.push({
      level: 'warn',
      message: `The public URL ${publicUrl} is not https; session cookies are sent without the Secure flag.`,
    });
  }

  if (getDatabaseConfig(env).url.startsWith('file:')) {
    issues.push({
      level: 'warn',
      message:
        'DATABASE_URL points to a local SQLite file. Serverless file systems are ephemeral; use a Turso (libsql://) database unless you deploy the Node/Docker target with a volume.',
    });
  }
  if (!env.RESEND_API_KEY) {
    issues.push({
      level: 'warn',
      message:
        'RESEND_API_KEY is not set: magic links, email verification, password resets and newsletter confirmations are unavailable until email delivery is configured.',
    });
  }
  if (!env.CONTACT_TO_EMAIL) {
    issues.push({
      level: 'warn',
      message:
        'CONTACT_TO_EMAIL is not set: contact form messages are stored but nobody is notified. Review them at /admin/messages.',
    });
  }
  return issues;
}

/**
 * Logs warnings and throws on errors from `checkProductionConfig`. Called once per server
 * instance from the middleware (not at import time, so builds never depend on runtime
 * secrets).
 */
export function assertProductionConfig(
  env: Record<string, string | undefined> = process.env,
): void {
  const issues = checkProductionConfig(env);
  for (const issue of issues) {
    if (issue.level === 'warn') console.warn(`[config] ${issue.message}`);
  }
  const errors = issues.filter((issue) => issue.level === 'error');
  if (errors.length > 0) {
    throw new Error(
      `Invalid production configuration:\n${errors.map((issue) => `- ${issue.message}`).join('\n')}`,
    );
  }
}
