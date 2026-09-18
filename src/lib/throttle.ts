import { sql } from 'drizzle-orm';

import type { Database } from '../db/client';
import { throttle } from '../db/schema/app';

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
 * Implemented as a single upsert so concurrent requests on serverless platforms cannot
 * race: the window is reset atomically when it has expired, otherwise the counter is
 * incremented. Works on any libSQL/SQLite backend.
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

  const count = row?.count ?? 1;
  const resetAt = row?.resetAt ?? new Date(nextResetMs);
  return {
    allowed: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    resetAt,
  };
}

/** Deletes expired counters; called opportunistically by maintenance scripts. */
export async function pruneThrottle(db: Database, now: Date = new Date()): Promise<void> {
  await db.delete(throttle).where(sql`${throttle.resetAt} <= ${now.getTime()}`);
}

/** SHA-256 hex digest so throttle keys never store raw addresses or IPs. */
export async function hashThrottleKey(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
