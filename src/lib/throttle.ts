import { sql } from 'drizzle-orm';

import type { Database } from '../db/client';
import { throttle } from '../db/schema/app';

import { getEnv } from './env';

export interface ThrottleRule {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface ThrottleResult {
  allowed: boolean;
  /** Requests left in the current window (0 when blocked). */
  remaining: number;
  /** When the current window ends. */
  resetAt: Date;
}

/**
 * Counts one request against `key` and reports whether it is within `rule`.
 *
 * A single upsert, so concurrent requests on serverless platforms cannot race: the window is
 * reset atomically when it has expired, otherwise the counter is incremented.
 */
export async function consumeThrottle(
  db: Database,
  key: string,
  rule: ThrottleRule,
  now: Date = new Date(),
): Promise<ThrottleResult> {
  const nowMs = now.getTime();
  const nextResetMs = nowMs + rule.windowMs;

  const [row] = await db
    .insert(throttle)
    .values({ key, count: 1, resetAt: new Date(nextResetMs) })
    .onConflictDoUpdate({
      target: throttle.key,
      set: {
        count: sql`CASE WHEN ${throttle.resetAt} <= ${nowMs} THEN 1 ELSE ${throttle.count} + 1 END`,
        resetAt: sql`CASE WHEN ${throttle.resetAt} <= ${nowMs} THEN ${nextResetMs} ELSE ${throttle.resetAt} END`,
      },
    })
    .returning({ count: throttle.count, resetAt: throttle.resetAt });
  if (!row) throw new Error('Throttle upsert returned no row.');

  return {
    allowed: row.count <= rule.limit,
    remaining: Math.max(0, rule.limit - row.count),
    resetAt: row.resetAt,
  };
}

/**
 * Keyed hash (HMAC-SHA256 with `BETTER_AUTH_SECRET`) so throttle keys never store raw
 * addresses or IPs and cannot be reversed by hashing the IPv4 space or an address list.
 * Without a secret (local development) it falls back to a plain SHA-256.
 */
export async function hashThrottleKey(
  value: string,
  secret: string | undefined = getEnv('BETTER_AUTH_SECRET'),
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const digest = secret
    ? await crypto.subtle.sign(
        'HMAC',
        await crypto.subtle.importKey(
          'raw',
          encoder.encode(secret),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign'],
        ),
        data,
      )
    : await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
