import type { APIRoute } from 'astro';
import { sql } from 'drizzle-orm';

import pkg from '../../../package.json';
import { db } from '@/db/client';
import { isEmailConfigured } from '@/lib/email';
import { getEnv } from '@/lib/env';

export const prerender = false;

/**
 * Liveness and readiness endpoint for uptime checks and deploy verification.
 *
 * `status` is `ok` when the database answers, `degraded` (HTTP 503) otherwise. `checks`
 * also reports whether optional integrations are configured so a deployment that stores
 * messages nobody reads, or cannot send sign-in links, is visible without digging through
 * logs. No secrets are exposed.
 */
export const GET: APIRoute = async () => {
  let database: 'ok' | 'error' = 'ok';
  try {
    await db.run(sql`select 1`);
  } catch (error) {
    console.error('[health] database check failed', error);
    database = 'error';
  }

  const body = {
    status: database === 'ok' ? 'ok' : 'degraded',
    name: pkg.name,
    version: pkg.version,
    target: __DEPLOY_TARGET__,
    time: new Date().toISOString(),
    checks: {
      database,
      email: isEmailConfigured() ? 'configured' : 'not-configured',
      contactNotifications: getEnv('CONTACT_TO_EMAIL') ? 'configured' : 'not-configured',
    },
  } as const;

  return Response.json(body, {
    status: database === 'ok' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
};
