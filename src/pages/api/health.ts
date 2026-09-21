import type { APIRoute } from 'astro';
import { sql } from 'drizzle-orm';

import pkg from '../../../package.json';
import { db } from '@/db/client';
import { isAdmin } from '@/lib/admin';
import { isEmailConfigured } from '@/lib/email';
import { getEnv } from '@/lib/env';
import { getAuthoritativeSession } from '@/lib/session';

export const prerender = false;

/**
 * Liveness and readiness endpoint for uptime checks and deploy verification.
 *
 * Everyone gets `status` (`ok` when the database answers, `degraded` with HTTP 503
 * otherwise) and the time. The details, which reveal how the deployment is configured
 * (version, target, whether email and contact notifications are set up), are only included
 * for a signed-in administrator (confirmed against the database, not the cookie cache) or a
 * request carrying `Authorization: Bearer <HEALTH_TOKEN>`, so the public route does not double
 * as reconnaissance. No secrets are ever exposed.
 */
export const GET: APIRoute = async ({ request, locals }) => {
  let database: 'ok' | 'error' = 'ok';
  try {
    await db.run(sql`select 1`);
  } catch (error) {
    console.error('[health] database check failed', error);
    database = 'error';
  }

  const status = database === 'ok' ? 'ok' : 'degraded';
  const time = new Date().toISOString();
  // The token costs nothing to check. The admin lookup reads the database, so it only runs
  // when a session cookie is present; anonymous monitors never trigger it.
  const detailed =
    hasHealthToken(request) ||
    (locals.user ? isAdmin((await getAuthoritativeSession(request.headers)).user) : false);

  const body = detailed
    ? {
        status,
        time,
        name: pkg.name,
        version: pkg.version,
        target: __DEPLOY_TARGET__,
        checks: {
          database,
          email: isEmailConfigured() ? 'configured' : 'not-configured',
          contactNotifications: getEnv('CONTACT_TO_EMAIL') ? 'configured' : 'not-configured',
        },
      }
    : { status, time };

  return Response.json(body, {
    status: database === 'ok' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
};

/** Constant-time comparison of the bearer token with `HEALTH_TOKEN` (unset: never matches). */
function hasHealthToken(request: Request): boolean {
  const expected = getEnv('HEALTH_TOKEN');
  const header = request.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  if (!expected || !provided) return false;

  const a = new TextEncoder().encode(expected);
  const b = new TextEncoder().encode(provided);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    diff |= (a[i % a.length] ?? 0) ^ (b[i % b.length] ?? 0);
  }
  return diff === 0;
}
