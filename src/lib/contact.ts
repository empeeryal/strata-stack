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

export type ContactOutcome = {
  ok: true;
  /**
   * - `sent`: stored and the owner was notified
   * - `failed`: stored, notification failed (retry from the admin inbox)
   * - `skipped`: stored, no recipient configured
   * - `ignored`: honeypot triggered, nothing stored
   */
  delivery: DeliveryStatus | 'ignored';
};

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
 *    failures never fail the request, so a retry cannot create duplicates.
 */
export async function submitContactMessage(
  input: ContactSubmission,
  context: ContactRequestContext,
  deps: ContactDeps,
): Promise<ContactOutcome> {
  if (input.website && input.website.trim() !== '') {
    return { ok: true, delivery: 'ignored' };
  }

  const now = deps.now ?? (() => new Date());
  const email = input.email.trim().toLowerCase();

  const checks: Array<[string, ThrottleRule]> = [
    [`contact:email:${await hashThrottleKey(email)}`, CONTACT_LIMITS.perEmail],
  ];
  if (context.ip) {
    checks.unshift([`contact:ip:${await hashThrottleKey(context.ip)}`, CONTACT_LIMITS.perIp]);
  }
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

  if (!deps.recipient) return { ok: true, delivery: 'skipped' };
  const delivery = await deliverContactMessage(id, deps);
  return { ok: true, delivery };
}

/**
 * Sends (or re-sends) the owner notification for a stored message and records the
 * outcome. Used by the initial submission and by the admin "retry" action.
 */
export async function deliverContactMessage(
  id: string,
  deps: ContactDeps,
): Promise<DeliveryStatus> {
  const now = deps.now ?? (() => new Date());
  const [row] = await deps.db
    .select()
    .from(contactMessages)
    .where(eq(contactMessages.id, id))
    .limit(1);
  if (!row) throw new Error(`Contact message ${id} not found.`);
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
