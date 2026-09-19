import type { Client } from '@libsql/client';

// Plain SQL on the libSQL client so `pnpm db:prune` can run this outside Astro and Vite.

export interface RetentionOptions {
  /** Days after which archived messages are deleted. */
  retentionDays: number;
  /** Days after which messages of any status are deleted; null keeps open messages. */
  maxAgeDays: number | null;
  now?: number;
}

export interface RetentionResult {
  archivedRemoved: number;
  /** Null when no maximum age is configured. */
  expiredRemoved: number | null;
  countersRemoved: number;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Deletes archived contact messages older than `retentionDays`, every message older than
 * `maxAgeDays` when that is set, and throttle counters whose window has ended.
 */
export async function pruneStaleData(
  client: Client,
  options: RetentionOptions,
): Promise<RetentionResult> {
  const now = options.now ?? Date.now();

  const archived = await client.execute({
    sql: "DELETE FROM contact_message WHERE status = 'archived' AND archived_at IS NOT NULL AND archived_at < ?",
    args: [now - options.retentionDays * DAY],
  });

  let expiredRemoved: number | null = null;
  if (options.maxAgeDays !== null) {
    const expired = await client.execute({
      sql: 'DELETE FROM contact_message WHERE created_at < ?',
      args: [now - options.maxAgeDays * DAY],
    });
    expiredRemoved = expired.rowsAffected;
  }

  const counters = await client.execute({
    sql: 'DELETE FROM throttle WHERE reset_at <= ?',
    args: [now],
  });

  return {
    archivedRemoved: archived.rowsAffected,
    expiredRemoved,
    countersRemoved: counters.rowsAffected,
  };
}
