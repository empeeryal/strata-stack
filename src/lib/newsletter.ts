import { and, eq, ne } from 'drizzle-orm';

import type { Database } from '../db/client';
import { newsletterSubscribers } from '../db/schema/app';

import { recordAudit, writeAudit } from './admin';
import type { EmailMessage } from './email';
import { describeError } from './errors';
import { consumeThrottle, hashThrottleKey, type ThrottleRule } from './throttle';

/**
 * Mirror of the confirmed subscribers at the email provider (a Resend audience), so
 * newsletters can be sent from there. Both calls throw on failure; the caller records the
 * error on the row instead of failing the visitor's request.
 */
export interface NewsletterAudience {
  /** Adds the address, or marks it subscribed again when it is already known. */
  add(email: string): Promise<void>;
  /** Marks the address unsubscribed. */
  remove(email: string): Promise<void>;
}

export interface NewsletterDeps {
  db: Database;
  sendEmail: (message: EmailMessage) => Promise<unknown>;
  siteName: string;
  /** Public origin without a trailing slash, used to build the links in the emails. */
  siteUrl: string;
  /** Provider audience to mirror confirmed addresses into; null keeps them in the database only. */
  audience?: NewsletterAudience | null;
  now?: () => Date;
}

/** Where a subscription was requested from; stored for the owner's information only. */
export const NEWSLETTER_SOURCES = ['footer', 'blog', 'page', 'docs'] as const;
export type NewsletterSource = (typeof NEWSLETTER_SOURCES)[number];

export interface SubscribeInput {
  email: string;
  source?: NewsletterSource | undefined;
  /** Honeypot field: hidden from people, filled in by bots. */
  website?: string | undefined;
}

export interface SubscribeContext {
  /** Client address as resolved by the adapter, or null when unavailable. */
  ip: string | null;
}

/**
 * What happened to a subscription request. Visitors see the same "check your inbox" message
 * for every outcome, so the form cannot be used to find out which addresses are subscribed.
 *
 * - `confirmation-sent`: a new or pending or previously unsubscribed address; a confirmation
 *   email with a fresh token was sent
 * - `already-subscribed`: the address is confirmed; an email saying so, with the unsubscribe
 *   link, was sent instead
 * - `ignored`: the honeypot was filled in; nothing was stored or sent
 */
export type SubscribeOutcome = 'confirmation-sent' | 'already-subscribed' | 'ignored';

export type ConfirmOutcome = 'confirmed' | 'already-confirmed' | 'invalid';

/** How long a confirmation link stays valid; the prune job removes stale pending rows later. */
export const CONFIRMATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export type UnsubscribeOutcome = 'unsubscribed' | 'already-unsubscribed' | 'invalid';

/**
 * What a provider webhook delivery did:
 *
 * - `unsubscribed`: the address opted out (or was deleted) at the provider and the row now
 *   says so
 * - `ignored`: nothing to do, because the event is not an opt-out, the row already agrees,
 *   the payload has no usable address, or the event predates the address's current
 *   confirmation (the provider retries failed deliveries for more than a day, and a retried
 *   opt-out must not undo a subscription made since)
 * - `unknown-address`: the provider knows an address this site never stored
 */
export type ProviderEventOutcome = 'unsubscribed' | 'ignored' | 'unknown-address';

/** Thrown when a sender exceeds the subscription limits. */
export class NewsletterThrottledError extends Error {
  constructor(public readonly resetAt: Date) {
    super('Too many subscription requests. Please try again later.');
    this.name = 'NewsletterThrottledError';
  }
}

/** Thrown when the confirmation email could not be sent; the request is kept for a retry. */
export class NewsletterEmailError extends Error {
  constructor(cause: unknown) {
    super('The confirmation email could not be sent.', { cause });
    this.name = 'NewsletterEmailError';
  }
}

/**
 * Subscription limits; all three apply. The per-sender numbers are the contact form's. The
 * site-wide ceiling bounds how many confirmation emails the form can be made to send in an
 * hour when the per-IP rule is defeated, for example by a proxy that forwards a visitor's own
 * `X-Forwarded-For` value (see the Node deployment guide); it is well above what a site this
 * size sees from people.
 */
export const NEWSLETTER_LIMITS: {
  perIp: ThrottleRule;
  perEmail: ThrottleRule;
  site: ThrottleRule;
} = {
  // Test runs get room for the end-to-end suite's retries, like the contact form's rule.
  perIp: { limit: process.env.NODE_ENV === 'test' ? 50 : 5, windowMs: 15 * 60 * 1000 },
  perEmail: { limit: 3, windowMs: 60 * 60 * 1000 },
  site: { limit: 120, windowMs: 60 * 60 * 1000 },
};

/** 256 random bits as base64url: URL-safe and free of characters that mail clients break on. */
export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

/** Tokens are base64url of 32 bytes; anything else is rejected before touching the database. */
export function isTokenShape(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

function confirmUrl(siteUrl: string, token: string): string {
  return `${siteUrl}/newsletter/confirm?token=${encodeURIComponent(token)}`;
}

export function unsubscribeUrl(siteUrl: string, token: string): string {
  return `${siteUrl}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
}

function confirmationEmail(to: string, token: string, deps: NewsletterDeps): EmailMessage {
  const url = confirmUrl(deps.siteUrl, token);
  return {
    to,
    subject: `Confirm your subscription to ${deps.siteName}`,
    text: `Open this link and press Confirm to receive email from ${deps.siteName}:\n\n${url}\n\nIf you did not request this, you can ignore this email and nothing will be sent.`,
    html: `<p>Open this link and press <strong>Confirm</strong> to receive email from <strong>${deps.siteName}</strong>:</p><p><a href="${url}">${url}</a></p><p>If you did not request this, you can ignore this email and nothing will be sent.</p>`,
  };
}

function alreadySubscribedEmail(to: string, token: string, deps: NewsletterDeps): EmailMessage {
  const url = unsubscribeUrl(deps.siteUrl, token);
  return {
    to,
    subject: `You are already subscribed to ${deps.siteName}`,
    text: `${to} already receives email from ${deps.siteName}, so nothing has changed.\n\nTo stop receiving it, open this link:\n\n${url}`,
    html: `<p>${to} already receives email from <strong>${deps.siteName}</strong>, so nothing has changed.</p><p>To stop receiving it, open this link:</p><p><a href="${url}">${url}</a></p>`,
  };
}

/**
 * Handles a subscription request end to end:
 *
 * 1. a filled honeypot is answered with success without storing anything;
 * 2. per-IP and per-address throttles are applied (persistent, so they work on serverless);
 * 3. the address is stored as `pending` with a fresh token (an unsubscribed address starts
 *    over; a pending one gets a new token, which invalidates the earlier email);
 * 4. the confirmation email is sent. If that fails the request is kept and the error is
 *    reported, because without the email the visitor can never confirm; submitting again
 *    sends a new one.
 *
 * A confirmed address is not touched: the visitor gets an email saying so, with the
 * unsubscribe link, and the same response as everyone else.
 */
export async function subscribeToNewsletter(
  input: SubscribeInput,
  context: SubscribeContext,
  deps: NewsletterDeps,
): Promise<SubscribeOutcome> {
  if (input.website?.trim()) return 'ignored';

  const now = deps.now ?? (() => new Date());
  const email = input.email.trim().toLowerCase();

  const checks: Array<[string, ThrottleRule]> = [];
  if (context.ip) {
    checks.push([`newsletter:ip:${await hashThrottleKey(context.ip)}`, NEWSLETTER_LIMITS.perIp]);
  }
  checks.push([`newsletter:email:${await hashThrottleKey(email)}`, NEWSLETTER_LIMITS.perEmail]);
  checks.push(['newsletter:site', NEWSLETTER_LIMITS.site]);
  for (const [key, rule] of checks) {
    const result = await consumeThrottle(deps.db, key, rule, now());
    if (!result.allowed) throw new NewsletterThrottledError(result.resetAt);
  }

  const [existing] = await deps.db
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, email))
    .limit(1);

  if (existing?.status === 'confirmed') {
    // The provider may still be missing this address from an earlier failure; this is a change
    // to the address, so it is the moment to try again.
    if (existing.audienceError) await syncAudience(existing.id, email, 'add', deps);
    await send(alreadySubscribedEmail(email, existing.token, deps));
    return 'already-subscribed';
  }

  const token = generateToken();
  const at = now();
  const pending = {
    status: 'pending' as const,
    token,
    confirmationSentAt: at,
    unsubscribedAt: null,
    updatedAt: at,
    // A pending address is not at the provider by design; a result from its earlier life
    // would otherwise show up in the admin list as a failure that needs attention.
    audienceSyncedAt: null,
    audienceError: null,
  };
  // Both writes refuse to touch a confirmed row: the owner may have opened the confirmation
  // link between the select above and this statement, and a new pending token would retire a
  // live subscription (the provider would keep sending to an address this site calls pending).
  let stored: { status: string } | undefined;
  if (existing) {
    [stored] = await deps.db
      .update(newsletterSubscribers)
      .set(pending)
      .where(
        and(
          eq(newsletterSubscribers.id, existing.id),
          ne(newsletterSubscribers.status, 'confirmed'),
        ),
      )
      .returning({ status: newsletterSubscribers.status });
  } else {
    // Two first-time requests for one address can race past the select above; the second
    // then lands on the unique index and takes the pending row over instead of failing.
    [stored] = await deps.db
      .insert(newsletterSubscribers)
      .values({
        id: crypto.randomUUID(),
        email,
        ...pending,
        source: input.source ?? null,
        createdAt: at,
      })
      .onConflictDoUpdate({
        target: newsletterSubscribers.email,
        set: pending,
        setWhere: ne(newsletterSubscribers.status, 'confirmed'),
      })
      .returning({ status: newsletterSubscribers.status });
  }
  if (!stored) {
    // The address was confirmed in between: behave like the confirmed branch above.
    const [confirmed] = await deps.db
      .select({ token: newsletterSubscribers.token })
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.email, email))
      .limit(1);
    if (confirmed) {
      await send(alreadySubscribedEmail(email, confirmed.token, deps));
      return 'already-subscribed';
    }
  }

  await send(confirmationEmail(email, token, deps));
  return 'confirmation-sent';

  async function send(message: EmailMessage): Promise<void> {
    try {
      await deps.sendEmail(message);
    } catch (error) {
      console.error('[newsletter] could not send email', error);
      throw new NewsletterEmailError(error);
    }
  }
}

/** The subscriber a confirm or unsubscribe link belongs to, or null. */
export async function findSubscriberByToken(db: Database, token: string) {
  if (!isTokenShape(token)) return null;
  const [row] = await db
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.token, token))
    .limit(1);
  return row ?? null;
}

/** Whether a pending address's confirmation link has passed its window. */
export function isConfirmationExpired(
  row: { confirmationSentAt: Date | null },
  at: Date = new Date(),
): boolean {
  return (
    row.confirmationSentAt !== null &&
    at.valueOf() - row.confirmationSentAt.valueOf() > CONFIRMATION_TTL_MS
  );
}

/**
 * Confirms the subscription a token belongs to and mirrors the address to the provider
 * audience when one is configured. A token of an unsubscribed address is refused: ending a
 * subscription must not be undone by an old confirmation link, only by subscribing again.
 *
 * Runs behind the button on the confirmation page, never on GET: mail clients and link
 * scanners open the links in an email, and a fetch must not subscribe an address that was
 * entered by someone else.
 */
export async function confirmSubscription(
  token: string,
  deps: NewsletterDeps,
): Promise<ConfirmOutcome> {
  const row = await findSubscriberByToken(deps.db, token);
  if (!row || row.status === 'unsubscribed') return 'invalid';
  if (row.status === 'confirmed') return 'already-confirmed';

  const now = deps.now ?? (() => new Date());
  const at = now();
  // A link from long ago no longer proves the address wants mail now.
  if (isConfirmationExpired(row, at)) return 'invalid';
  // The status predicate makes the change atomic: an unsubscribe or provider opt-out that
  // landed between the read above and this write wins, and the stale link stays invalid.
  const [confirmed] = await deps.db
    .update(newsletterSubscribers)
    .set({ status: 'confirmed', confirmedAt: at, updatedAt: at })
    .where(and(eq(newsletterSubscribers.id, row.id), eq(newsletterSubscribers.status, 'pending')))
    .returning({ id: newsletterSubscribers.id });
  if (!confirmed) return 'invalid';
  await syncAudience(row.id, row.email, 'add', deps);
  return 'confirmed';
}

/** Ends the subscription a token belongs to and updates the provider audience. */
export async function unsubscribeFromNewsletter(
  token: string,
  deps: NewsletterDeps,
): Promise<UnsubscribeOutcome> {
  const row = await findSubscriberByToken(deps.db, token);
  if (!row) return 'invalid';
  if (row.status === 'unsubscribed') return 'already-unsubscribed';

  const now = deps.now ?? (() => new Date());
  const at = now();
  const [ended] = await deps.db
    .update(newsletterSubscribers)
    .set({ status: 'unsubscribed', unsubscribedAt: at, updatedAt: at })
    .where(
      and(eq(newsletterSubscribers.id, row.id), ne(newsletterSubscribers.status, 'unsubscribed')),
    )
    .returning({ status: newsletterSubscribers.status });
  if (!ended) return 'already-unsubscribed';
  if (row.status === 'confirmed') await syncAudience(row.id, row.email, 'remove', deps);
  return 'unsubscribed';
}

/**
 * Pushes one change to the provider audience and records the result on the row. Failures
 * are recorded, not thrown: the database is the source of truth, and the admin subscribers
 * page shows which addresses the provider has not received yet.
 */
async function syncAudience(
  id: string,
  email: string,
  change: 'add' | 'remove',
  deps: NewsletterDeps,
): Promise<boolean> {
  if (!deps.audience) return false;
  const now = deps.now ?? (() => new Date());
  try {
    if (change === 'add') await deps.audience.add(email);
    else await deps.audience.remove(email);
    await deps.db
      .update(newsletterSubscribers)
      .set({ audienceSyncedAt: now(), audienceError: null })
      .where(eq(newsletterSubscribers.id, id));
    return true;
  } catch (error) {
    console.error(`[newsletter] audience ${change} failed`, error);
    await deps.db
      .update(newsletterSubscribers)
      .set({ audienceError: describeError(error) })
      .where(eq(newsletterSubscribers.id, id));
    return false;
  }
}

/**
 * Applies a contact event from the email provider's webhook (Resend's `contact.updated` and
 * `contact.deleted`). Only opt-outs flow back: an address unsubscribed or deleted at the
 * provider is marked unsubscribed here, so the two lists agree about who receives email. The
 * reverse is deliberately not mirrored: a contact re-subscribed at the provider still has to
 * confirm through the site's own double opt-in. The change is recorded in the audit log.
 */
export async function applyProviderContactEvent(
  event: unknown,
  deps: NewsletterDeps,
): Promise<ProviderEventOutcome> {
  if (!event || typeof event !== 'object') return 'ignored';
  const {
    type,
    data,
    created_at: createdAt,
  } = event as {
    type?: unknown;
    data?: unknown;
    created_at?: unknown;
  };
  if (typeof type !== 'string' || !data || typeof data !== 'object') return 'ignored';
  const {
    email: rawEmail,
    unsubscribed,
    updated_at: updatedAt,
  } = data as { email?: unknown; unsubscribed?: unknown; updated_at?: unknown };
  if (typeof rawEmail !== 'string' || !rawEmail.includes('@')) return 'ignored';

  const optedOut =
    type === 'contact.deleted' || (type === 'contact.updated' && unsubscribed === true);
  if (!optedOut) return 'ignored';

  const email = rawEmail.trim().toLowerCase();
  const [row] = await deps.db
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, email))
    .limit(1);
  if (!row) return 'unknown-address';
  if (row.status === 'unsubscribed') return 'ignored';
  // Each retry of a delivery is signed afresh, so the signature's timestamp says nothing about
  // when the opt-out happened; the event's own time does.
  const happenedAt = eventTime(createdAt) ?? eventTime(updatedAt);
  if (happenedAt && row.confirmedAt && happenedAt < row.confirmedAt) return 'ignored';

  const now = deps.now ?? (() => new Date());
  const at = now();
  const [ended] = await deps.db
    .update(newsletterSubscribers)
    .set({
      status: 'unsubscribed',
      unsubscribedAt: at,
      updatedAt: at,
      // The provider is the source of this change, so it needs no sync back.
      audienceSyncedAt: at,
      audienceError: null,
    })
    .where(
      and(eq(newsletterSubscribers.id, row.id), ne(newsletterSubscribers.status, 'unsubscribed')),
    )
    .returning({ id: newsletterSubscribers.id });
  if (!ended) return 'ignored';
  await recordAudit(deps.db, {
    action: 'subscriber.unsubscribe',
    targetType: 'subscriber',
    targetId: row.id,
    details: { via: 'provider', event: type },
  });
  return 'unsubscribed';
}

function eventTime(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

/** Thrown when the subscriber an admin operation targets does not exist (or was just removed). */
export class SubscriberNotFoundError extends Error {
  constructor() {
    super('Subscriber not found.');
    this.name = 'SubscriberNotFoundError';
  }
}

/**
 * What an admin removal did at the provider: `removed-unsynced` means the row is gone here
 * but the contact could not be updated at the provider and still needs attention there.
 */
export type RemoveSubscriberOutcome = 'removed' | 'removed-unsynced';

/**
 * Deletes a subscriber for an administrator. An address the provider may still be sending to
 * (confirmed, or unsubscribed with the opt-out not yet delivered) is marked unsubscribed there
 * first, then the row and its audit entry are written in one transaction. When the provider
 * refuses, the row is not deleted but kept as an opt-out with the error on it: deleting it would
 * leave nothing that says which contact still needs to go, while a kept row is shown on the
 * subscribers page and retried by the retention job, which deletes it once the provider has
 * taken the opt-out. Two admins removing the same row see one success and one "not found".
 */
export async function removeSubscriber(
  id: string,
  actor: { id: string; email: string },
  deps: NewsletterDeps,
): Promise<RemoveSubscriberOutcome> {
  const [row] = await deps.db
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.id, id))
    .limit(1);
  if (!row) throw new SubscriberNotFoundError();

  let provider: 'removed' | 'failed' | 'skipped' = 'skipped';
  let providerError: string | null = null;
  const providerMaySend =
    row.status === 'confirmed' || (row.status === 'unsubscribed' && row.audienceError !== null);
  if (providerMaySend && deps.audience) {
    try {
      await deps.audience.remove(row.email);
      provider = 'removed';
    } catch (error) {
      console.error('[newsletter] audience remove failed', error);
      provider = 'failed';
      providerError = describeError(error);
    }
  }

  const now = deps.now ?? (() => new Date());
  await deps.db.transaction(async (tx) => {
    const changed =
      provider === 'failed'
        ? await tx
            .update(newsletterSubscribers)
            .set({
              status: 'unsubscribed',
              unsubscribedAt: row.unsubscribedAt ?? now(),
              updatedAt: now(),
              audienceSyncedAt: null,
              audienceError: providerError,
            })
            .where(eq(newsletterSubscribers.id, id))
            .returning({ id: newsletterSubscribers.id })
        : await tx
            .delete(newsletterSubscribers)
            .where(eq(newsletterSubscribers.id, id))
            .returning({ id: newsletterSubscribers.id });
    if (changed.length === 0) throw new SubscriberNotFoundError();
    await writeAudit(tx, {
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'subscriber.delete',
      targetType: 'subscriber',
      targetId: id,
      details:
        provider === 'failed'
          ? { status: row.status, provider, kept: true }
          : { status: row.status, provider },
    });
  });
  return provider === 'failed' ? 'removed-unsynced' : 'removed';
}
