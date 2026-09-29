import { eq } from 'drizzle-orm';

import type { Database } from '../db/client';
import { newsletterSubscribers } from '../db/schema/app';

import { recordAudit } from './admin';
import type { EmailMessage } from './email';
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
export type UnsubscribeOutcome = 'unsubscribed' | 'already-unsubscribed' | 'invalid';

/**
 * What a provider webhook delivery did:
 *
 * - `unsubscribed`: the address opted out (or was deleted) at the provider and the row now
 *   says so
 * - `ignored`: nothing to do, because the event is not an opt-out, the row already agrees, or
 *   the payload has no usable address
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

/** Per-sender limits; both apply. Same numbers as the contact form. */
export const NEWSLETTER_LIMITS: { perIp: ThrottleRule; perEmail: ThrottleRule } = {
  perIp: { limit: 5, windowMs: 15 * 60 * 1000 },
  perEmail: { limit: 3, windowMs: 60 * 60 * 1000 },
};

const MAX_ERROR_LENGTH = 500;

function describeError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.slice(0, MAX_ERROR_LENGTH);
}

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

export function confirmUrl(siteUrl: string, token: string): string {
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
    text: `Open this link to confirm that you want to receive email from ${deps.siteName}:\n\n${url}\n\nIf you did not request this, you can ignore this email and nothing will be sent.`,
    html: `<p>Open this link to confirm that you want to receive email from <strong>${deps.siteName}</strong>:</p><p><a href="${url}">${url}</a></p><p>If you did not request this, you can ignore this email and nothing will be sent.</p>`,
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
    await send(alreadySubscribedEmail(email, existing.token, deps));
    return 'already-subscribed';
  }

  const token = generateToken();
  const at = now();
  if (existing) {
    await deps.db
      .update(newsletterSubscribers)
      .set({
        status: 'pending',
        token,
        confirmationSentAt: at,
        unsubscribedAt: null,
        updatedAt: at,
      })
      .where(eq(newsletterSubscribers.id, existing.id));
  } else {
    await deps.db.insert(newsletterSubscribers).values({
      id: crypto.randomUUID(),
      email,
      status: 'pending',
      token,
      source: input.source ?? null,
      confirmationSentAt: at,
      createdAt: at,
      updatedAt: at,
    });
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

/**
 * Confirms the subscription a token belongs to and mirrors the address to the provider
 * audience when one is configured. A token of an unsubscribed address is refused: ending a
 * subscription must not be undone by an old confirmation link, only by subscribing again.
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
  await deps.db
    .update(newsletterSubscribers)
    .set({ status: 'confirmed', confirmedAt: at, updatedAt: at })
    .where(eq(newsletterSubscribers.id, row.id));
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
  await deps.db
    .update(newsletterSubscribers)
    .set({ status: 'unsubscribed', unsubscribedAt: at, updatedAt: at })
    .where(eq(newsletterSubscribers.id, row.id));
  if (row.status === 'confirmed') await syncAudience(row.id, row.email, 'remove', deps);
  return 'unsubscribed';
}

/**
 * Pushes one change to the provider audience and records the result on the row. Failures
 * are recorded, not thrown: the database is the source of truth, and the admin subscribers
 * page shows which addresses the provider has not received yet.
 */
export async function syncAudience(
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
  const { type, data } = event as { type?: unknown; data?: unknown };
  if (typeof type !== 'string' || !data || typeof data !== 'object') return 'ignored';
  const { email: rawEmail, unsubscribed } = data as { email?: unknown; unsubscribed?: unknown };
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

  const now = deps.now ?? (() => new Date());
  const at = now();
  await deps.db
    .update(newsletterSubscribers)
    .set({
      status: 'unsubscribed',
      unsubscribedAt: at,
      updatedAt: at,
      // The provider is the source of this change, so it needs no sync back.
      audienceSyncedAt: at,
      audienceError: null,
    })
    .where(eq(newsletterSubscribers.id, row.id));
  await recordAudit(deps.db, {
    action: 'subscriber.unsubscribe',
    targetType: 'subscriber',
    targetId: row.id,
    details: { via: 'provider', event: type },
  });
  return 'unsubscribed';
}
