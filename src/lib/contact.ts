import { and, eq, isNull, lt, or } from 'drizzle-orm';

import type { Database } from '../db/client';
import { contactMessages, type DeliveryStatus } from '../db/schema/app';

import { formatAddress, type EmailMessage } from './email';
import { consumeThrottle, hashThrottleKey, type ThrottleRule } from './throttle';

export interface ContactSubmission {
  name: string;
  email: string;
  message: string;
  /** Honeypot field: hidden from people, filled in by bots. */
  website?: string | undefined;
}

export interface ContactRequestContext {
  /** Client address as resolved by the adapter, or null when unavailable. */
  ip: string | null;
}

export interface ContactDeps {
  db: Database;
  sendEmail: (message: EmailMessage) => Promise<unknown>;
  /** Owner address that receives notifications; undefined disables them. */
  recipient: string | undefined;
  siteName: string;
  now?: () => Date;
}

/** Result of a notification attempt for a stored message. */
export type DeliveryOutcome = Exclude<DeliveryStatus, 'pending'>;

export interface ContactOutcome {
  /**
   * - `sent`: stored and the owner was notified
   * - `failed`: stored, notification failed (retry from the admin inbox)
   * - `skipped`: stored, no recipient configured
   * - `ignored`: honeypot triggered, nothing stored
   */
  delivery: DeliveryOutcome | 'ignored';
}

/** Thrown when a sender exceeds the contact limits. */
export class ContactThrottledError extends Error {
  constructor(public readonly resetAt: Date) {
    super('Too many messages. Please try again later.');
    this.name = 'ContactThrottledError';
  }
}

/** Thrown when another delivery attempt for the same message claimed it first. */
export class DeliveryInProgressError extends Error {
  constructor(public readonly messageId: string) {
    super('A notification for this message is already being sent.');
    this.name = 'DeliveryInProgressError';
  }
}

/**
 * How long a delivery claim blocks other attempts. Long enough for any provider call, short
 * enough that a crash between the claim and the result does not leave the message stuck.
 */
export const DELIVERY_LEASE_MS = 2 * 60 * 1000;

/** Per-sender limits; both apply. */
export const CONTACT_LIMITS: { perIp: ThrottleRule; perEmail: ThrottleRule } = {
  perIp: { limit: 5, windowMs: 15 * 60 * 1000 },
  perEmail: { limit: 3, windowMs: 60 * 60 * 1000 },
};

const MAX_ERROR_LENGTH = 500;

function describeError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.slice(0, MAX_ERROR_LENGTH);
}

/**
 * Handles a contact form submission end to end:
 *
 * 1. a filled honeypot is answered with success without storing anything;
 * 2. per-IP and per-address throttles are applied (persistent, so they work on serverless);
 * 3. the message is stored, which is the authoritative success;
 * 4. the owner notification is attempted and its result recorded on the row. Delivery
 *    failures never fail the request: the message is already stored and the owner can
 *    resend the notification from the admin inbox.
 *
 * Submissions are not idempotent: if the success response is lost in transit and the
 * visitor submits again, a second row is stored. The throttles bound how often that can
 * happen; add a client-generated key with a unique index if exactly-once matters to you.
 */
export async function submitContactMessage(
  input: ContactSubmission,
  context: ContactRequestContext,
  deps: ContactDeps,
): Promise<ContactOutcome> {
  if (input.website?.trim()) return { delivery: 'ignored' };

  const now = deps.now ?? (() => new Date());
  const email = input.email.trim().toLowerCase();

  const checks: Array<[string, ThrottleRule]> = [];
  if (context.ip) {
    checks.push([`contact:ip:${await hashThrottleKey(context.ip)}`, CONTACT_LIMITS.perIp]);
  }
  checks.push([`contact:email:${await hashThrottleKey(email)}`, CONTACT_LIMITS.perEmail]);
  for (const [key, rule] of checks) {
    const result = await consumeThrottle(deps.db, key, rule, now());
    if (!result.allowed) throw new ContactThrottledError(result.resetAt);
  }

  const id = crypto.randomUUID();
  await deps.db.insert(contactMessages).values({
    id,
    name: input.name.trim(),
    email,
    message: input.message.trim(),
    deliveryStatus: deps.recipient ? 'pending' : 'skipped',
    createdAt: now(),
  });

  if (!deps.recipient) return { delivery: 'skipped' };
  const delivery = await deliverContactMessage(id, deps);
  return { delivery: delivery ?? 'failed' };
}

/**
 * Sends (or re-sends) the owner notification for a stored message and records the
 * outcome. Returns null when no message has that id.
 *
 * The attempt is claimed before anything is sent: one conditional update sets the lease
 * (`deliveryClaimedAt`) and counts the attempt, and only succeeds while no unexpired lease
 * exists. Of any concurrent callers (a double-click, two administrators, two instances)
 * exactly one sends; the others get a `DeliveryInProgressError`. The lease is cleared with the
 * result and expires after `DELIVERY_LEASE_MS`, so a crash in between leaves the row retryable.
 */
export async function deliverContactMessage(
  id: string,
  deps: ContactDeps,
): Promise<DeliveryOutcome | null> {
  const now = deps.now ?? (() => new Date());
  const [row] = await deps.db
    .select()
    .from(contactMessages)
    .where(eq(contactMessages.id, id))
    .limit(1);
  if (!row) return null;
  if (!deps.recipient) {
    await deps.db
      .update(contactMessages)
      .set({ deliveryStatus: 'skipped' })
      .where(eq(contactMessages.id, id));
    return 'skipped';
  }

  const claimedAt = now();
  const claimed = await deps.db
    .update(contactMessages)
    .set({ deliveryClaimedAt: claimedAt, deliveryAttempts: row.deliveryAttempts + 1 })
    .where(
      and(
        eq(contactMessages.id, id),
        or(
          isNull(contactMessages.deliveryClaimedAt),
          lt(contactMessages.deliveryClaimedAt, new Date(claimedAt.valueOf() - DELIVERY_LEASE_MS)),
        ),
      ),
    )
    .returning({ id: contactMessages.id });
  if (claimed.length === 0) throw new DeliveryInProgressError(id);

  try {
    await deps.sendEmail({
      to: deps.recipient,
      // Replying from a mail client answers the visitor, not the sending address.
      replyTo: formatAddress(row.name, row.email),
      subject: `[${deps.siteName}] Contact form: ${row.name}`,
      text: `From: ${row.name} <${row.email}>\n\n${row.message}`,
    });
    await deps.db
      .update(contactMessages)
      .set({
        deliveryStatus: 'sent',
        deliveryError: null,
        deliveredAt: now(),
        deliveryClaimedAt: null,
      })
      .where(eq(contactMessages.id, id));
    return 'sent';
  } catch (error) {
    console.error('[contact] owner notification failed', error);
    await deps.db
      .update(contactMessages)
      .set({
        deliveryStatus: 'failed',
        deliveryError: describeError(error),
        deliveryClaimedAt: null,
      })
      .where(eq(contactMessages.id, id));
    return 'failed';
  }
}
