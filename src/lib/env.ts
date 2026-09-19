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

const stripSlash = (url: string) => url.replace(/\/+$/, '');

/** Public origin visitors use, e.g. https://example.com. */
export function getSiteUrl(): string {
  const explicit = getEnv('BETTER_AUTH_URL') ?? getEnv('SITE_URL');
  if (explicit) return stripSlash(explicit);

  // Platform-provided hosts (no protocol).
  const vercel = getEnv('VERCEL_PROJECT_PRODUCTION_URL') ?? getEnv('VERCEL_URL');
  if (vercel) return `https://${vercel}`;
  const netlify = getEnv('URL') ?? getEnv('DEPLOY_PRIME_URL');
  if (netlify) return stripSlash(netlify);

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
  }

  if (!env.DATABASE_URL || env.DATABASE_URL.startsWith('file:')) {
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
        'RESEND_API_KEY is not set: magic links, email verification and password resets are unavailable until email delivery is configured.',
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
