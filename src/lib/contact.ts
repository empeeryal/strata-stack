import { eq } from 'drizzle-orm';

import type { Database } from '../db/client';
import { contactMessages, type DeliveryStatus } from '../db/schema/app';

import type { EmailMessage } from './email';
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

  const attempts = row.deliveryAttempts + 1;
  try {
    await deps.sendEmail({
      to: deps.recipient,
      subject: `[${deps.siteName}] Contact form: ${row.name}`,
      text: `From: ${row.name} <${row.email}>\n\n${row.message}`,
    });
    await deps.db
      .update(contactMessages)
      .set({
        deliveryStatus: 'sent',
        deliveryAttempts: attempts,
        deliveryError: null,
        deliveredAt: now(),
      })
      .where(eq(contactMessages.id, id));
    return 'sent';
  } catch (error) {
    console.error('[contact] owner notification failed', error);
    await deps.db
      .update(contactMessages)
      .set({
        deliveryStatus: 'failed',
        deliveryAttempts: attempts,
        deliveryError: describeError(error),
      })
      .where(eq(contactMessages.id, id));
    return 'failed';
  }
}
