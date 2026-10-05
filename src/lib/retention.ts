import type { Client } from '@libsql/client';

import type { NewsletterAudience } from './newsletter';

// Plain SQL on the libSQL client so `pnpm db:prune` can run this outside Astro and Vite.

export interface RetentionOptions {
  /** Days after which archived messages are deleted. */
  retentionDays: number;
  /** Days after which messages of any status are deleted; null keeps open messages. */
  maxAgeDays: number | null;
  /** Days after which unconfirmed and unsubscribed newsletter addresses are deleted. */
  newsletterRetentionDays: number;
  /**
   * Provider audience to bring in line before pruning: confirmed addresses it never received
   * and opt-outs it was not told about are pushed again. Null skips the retries; the rows that
   * still need the provider are kept either way.
   */
  audience?: NewsletterAudience | null;
  now?: number;
}

export interface RetentionResult {
  archivedRemoved: number;
  /** Null when no maximum age is configured. */
  expiredRemoved: number | null;
  subscribersRemoved: number;
  countersRemoved: number;
  /** Sessions whose expiry has passed. Better Auth only removes one when its own cookie returns. */
  sessionsRemoved: number;
  /** Provider syncs that had failed earlier and succeeded now. */
  audienceSynced: number;
  /** Rows the provider still refused (or that could not be retried without an audience). */
  audienceFailed: number;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Deletes archived contact messages older than `retentionDays`, every message older than
 * `maxAgeDays` when that is set, newsletter addresses that were never confirmed or have
 * unsubscribed more than `newsletterRetentionDays` ago, and throttle counters whose window
 * has ended, and sessions that have expired (Better Auth deletes an expired session only when
 * that session's cookie is presented again, so a sign-in from a borrowed machine would otherwise
 * stay in the table, and on the dashboard, for ever). Before that it retries the provider syncs that failed, so an address that opted
 * out here while the provider was unavailable is not forgotten while the provider still sends
 * to it: such a row stays until the provider has been told.
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

  const { audienceSynced, audienceFailed } = await retryAudienceSyncs(client, options, now);

  // `updated_at` moves with every status change, so it dates the last confirmation email for a
  // pending address and the unsubscribe for an unsubscribed one. An opt-out the provider has not
  // received yet is kept, whatever its age: deleting it would leave the provider sending.
  const subscribers = await client.execute({
    sql: "DELETE FROM newsletter_subscriber WHERE status IN ('pending', 'unsubscribed') AND updated_at < ? AND NOT (status = 'unsubscribed' AND audience_error IS NOT NULL)",
    args: [now - options.newsletterRetentionDays * DAY],
  });

  const counters = await client.execute({
    sql: 'DELETE FROM throttle WHERE reset_at <= ?',
    args: [now],
  });

  const sessions = await client.execute({
    sql: 'DELETE FROM session WHERE expires_at <= ?',
    args: [now],
  });

  return {
    archivedRemoved: archived.rowsAffected,
    expiredRemoved,
    subscribersRemoved: subscribers.rowsAffected,
    countersRemoved: counters.rowsAffected,
    sessionsRemoved: sessions.rowsAffected,
    audienceSynced,
    audienceFailed,
  };
}

async function retryAudienceSyncs(
  client: Client,
  options: RetentionOptions,
  now: number,
): Promise<Pick<RetentionResult, 'audienceSynced' | 'audienceFailed'>> {
  const pending = await client.execute(
    "SELECT id, email, status FROM newsletter_subscriber WHERE audience_error IS NOT NULL AND status IN ('confirmed', 'unsubscribed')",
  );
  const audience = options.audience ?? null;
  if (!audience) return { audienceSynced: 0, audienceFailed: pending.rows.length };

  let audienceSynced = 0;
  for (const row of pending.rows) {
    const id = String(row.id);
    const email = String(row.email);
    try {
      if (row.status === 'confirmed') await audience.add(email);
      else await audience.remove(email);
      await client.execute({
        sql: 'UPDATE newsletter_subscriber SET audience_synced_at = ?, audience_error = NULL WHERE id = ?',
        args: [now, id],
      });
      audienceSynced += 1;
    } catch (error) {
      // The id, not the address: this line ends up in the workflow log.
      console.error(`[prune] audience sync for subscriber ${id} failed again`, error);
      await client.execute({
        sql: 'UPDATE newsletter_subscriber SET audience_error = ? WHERE id = ?',
        args: [error instanceof Error ? error.message : String(error), id],
      });
    }
  }
  return { audienceSynced, audienceFailed: pending.rows.length - audienceSynced };
}
