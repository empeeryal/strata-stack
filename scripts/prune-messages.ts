/**
 * Retention job: deletes archived contact messages older than CONTACT_RETENTION_DAYS
 * (default 365) and expired throttle counters. Run it from cron or a scheduled workflow:
 *
 *   pnpm db:prune
 *   CONTACT_RETENTION_DAYS=90 pnpm db:prune
 *
 * Open (new/read) messages are kept by default; archive them first. To enforce a maximum
 * age for every message regardless of status, set CONTACT_MAX_AGE_DAYS as well:
 *
 *   CONTACT_MAX_AGE_DAYS=730 pnpm db:prune
 */
import { createClient } from '@libsql/client';

import { getContactMaxAgeDays, getContactRetentionDays } from '../src/lib/env.ts';

const url = process.env.DATABASE_URL ?? 'file:./.data/local.db';
const authToken = process.env.DATABASE_AUTH_TOKEN;
const retentionDays = getContactRetentionDays();
const maxAgeDays = getContactMaxAgeDays();

const client = createClient(authToken ? { url, authToken } : { url });
const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;

const archived = await client.execute({
  sql: "DELETE FROM contact_message WHERE status = 'archived' AND archived_at IS NOT NULL AND archived_at < ?",
  args: [now - retentionDays * DAY],
});
console.log(
  `Removed ${archived.rowsAffected} archived message(s) older than ${retentionDays} days.`,
);

if (maxAgeDays !== null) {
  const expired = await client.execute({
    sql: 'DELETE FROM contact_message WHERE created_at < ?',
    args: [now - maxAgeDays * DAY],
  });
  console.log(
    `Removed ${expired.rowsAffected} message(s) of any status older than ${maxAgeDays} days (CONTACT_MAX_AGE_DAYS).`,
  );
} else {
  console.log('CONTACT_MAX_AGE_DAYS is not set: open (new/read) messages were kept.');
}

const counters = await client.execute({
  sql: 'DELETE FROM throttle WHERE reset_at <= ?',
  args: [now],
});
console.log(`Removed ${counters.rowsAffected} expired throttle counter(s).`);
client.close();
