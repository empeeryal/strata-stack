/**
 * Retention job: deletes archived contact messages older than CONTACT_RETENTION_DAYS
 * (default 365) and expired throttle counters. Run it from cron or a scheduled workflow:
 *
 *   pnpm db:prune
 *   CONTACT_RETENTION_DAYS=90 pnpm db:prune
 *
 * Open (new/read) messages are kept unless CONTACT_MAX_AGE_DAYS sets a maximum age for
 * every message regardless of status:
 *
 *   CONTACT_MAX_AGE_DAYS=730 pnpm db:prune
 */
import { getContactMaxAgeDays, getContactRetentionDays } from '../src/lib/env.ts';
import { pruneStaleData } from '../src/lib/retention.ts';

import { openDatabase } from './lib/db.ts';

const retentionDays = getContactRetentionDays();
const maxAgeDays = getContactMaxAgeDays();
const client = openDatabase();

const result = await pruneStaleData(client, { retentionDays, maxAgeDays });

console.log(
  `Removed ${result.archivedRemoved} archived message(s) older than ${retentionDays} days.`,
);
console.log(
  result.expiredRemoved === null
    ? 'CONTACT_MAX_AGE_DAYS is not set: open (new/read) messages were kept.'
    : `Removed ${result.expiredRemoved} message(s) of any status older than ${maxAgeDays} days.`,
);
console.log(`Removed ${result.countersRemoved} expired throttle counter(s).`);
client.close();
