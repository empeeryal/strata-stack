/**
 * Retention job: deletes archived contact messages older than CONTACT_RETENTION_DAYS
 * (default 365) and expired throttle counters. Run it from cron or a scheduled workflow:
 *
 *   pnpm db:prune
 *   CONTACT_RETENTION_DAYS=90 pnpm db:prune
 *
 * Open (new/read) messages are never deleted automatically; archive them first.
 */
import { createClient } from '@libsql/client';

const url = process.env.DATABASE_URL ?? 'file:./.data/local.db';
const authToken = process.env.DATABASE_AUTH_TOKEN;
const days = Number(process.env.CONTACT_RETENTION_DAYS ?? 365);
const retentionDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 365;

const client = createClient(authToken ? { url, authToken } : { url });
const now = Date.now();
const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;

const messages = await client.execute({
  sql: "DELETE FROM contact_message WHERE status = 'archived' AND archived_at IS NOT NULL AND archived_at < ?",
  args: [cutoff],
});
const counters = await client.execute({
  sql: 'DELETE FROM throttle WHERE reset_at <= ?',
  args: [now],
});

console.log(
  `Removed ${messages.rowsAffected} archived message(s) older than ${retentionDays} days and ${counters.rowsAffected} expired throttle counter(s).`,
);
client.close();
