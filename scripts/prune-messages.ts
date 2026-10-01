/**
 * Retention job: deletes archived contact messages older than CONTACT_RETENTION_DAYS
 * (default 365), newsletter addresses that were never confirmed or have unsubscribed more than
 * NEWSLETTER_RETENTION_DAYS (default 7) ago, expired sessions and expired throttle counters. When
 * RESEND_API_KEY and RESEND_AUDIENCE_ID are set it first retries the audience syncs that failed
 * (addresses the provider never received, opt-outs it was not told about); an opt-out the
 * provider still has not received is kept. Run it from cron or a scheduled workflow:
 *
 *   pnpm db:prune
 *   CONTACT_RETENTION_DAYS=90 pnpm db:prune
 *
 * Open (new/read) messages are kept unless CONTACT_MAX_AGE_DAYS sets a maximum age for
 * every message regardless of status:
 *
 *   CONTACT_MAX_AGE_DAYS=730 pnpm db:prune
 */
import { getNewsletterAudience } from '../src/lib/audience.ts';
import {
  getContactMaxAgeDays,
  getContactRetentionDays,
  getNewsletterRetentionDays,
} from '../src/lib/env.ts';
import { pruneStaleData } from '../src/lib/retention.ts';

import { openDatabase } from './lib/db.ts';

const retentionDays = getContactRetentionDays();
const maxAgeDays = getContactMaxAgeDays();
const newsletterRetentionDays = getNewsletterRetentionDays();
const client = openDatabase();
const audience = getNewsletterAudience();

const result = await pruneStaleData(client, {
  retentionDays,
  maxAgeDays,
  newsletterRetentionDays,
  audience,
});

console.log(
  audience
    ? `Retried failed audience syncs: ${result.audienceSynced} succeeded, ${result.audienceFailed} still failing.`
    : result.audienceFailed > 0
      ? `${result.audienceFailed} address(es) still need the audience; set RESEND_API_KEY and RESEND_AUDIENCE_ID for this job to retry them.`
      : 'No failed audience syncs to retry.',
);

console.log(
  `Removed ${result.archivedRemoved} archived message(s) older than ${retentionDays} days.`,
);
console.log(
  result.expiredRemoved === null
    ? 'CONTACT_MAX_AGE_DAYS is not set: open (new/read) messages were kept.'
    : `Removed ${result.expiredRemoved} message(s) of any status older than ${maxAgeDays} days.`,
);
console.log(
  `Removed ${result.subscribersRemoved} unconfirmed or unsubscribed newsletter address(es) older than ${newsletterRetentionDays} days.`,
);
console.log(`Removed ${result.countersRemoved} expired throttle counter(s).`);
console.log(`Removed ${result.sessionsRemoved} expired session(s).`);
client.close();
