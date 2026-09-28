import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Workflow state of a contact message in the admin inbox. */
export const CONTACT_STATUSES = ['new', 'read', 'archived'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

/** Whether the owner notification for a message was delivered. */
export const DELIVERY_STATUSES = ['pending', 'sent', 'failed', 'skipped'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** Messages submitted through the contact form (see src/lib/contact.ts). */
export const contactMessages = sqliteTable(
  'contact_message',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    message: text('message').notNull(),
    status: text('status', { enum: CONTACT_STATUSES }).notNull().default('new'),
    deliveryStatus: text('delivery_status', { enum: DELIVERY_STATUSES })
      .notNull()
      .default('pending'),
    deliveryAttempts: integer('delivery_attempts').notNull().default(0),
    deliveryError: text('delivery_error'),
    /** Set while a notification is being sent; a lease that keeps concurrent retries to one. */
    deliveryClaimedAt: integer('delivery_claimed_at', { mode: 'timestamp_ms' }),
    deliveredAt: integer('delivered_at', { mode: 'timestamp_ms' }),
    readAt: integer('read_at', { mode: 'timestamp_ms' }),
    archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    // The inbox lists by status or delivery state, newest first; the overview counts failures.
    index('contact_message_status_created_at_idx').on(table.status, table.createdAt),
    index('contact_message_delivery_created_at_idx').on(table.deliveryStatus, table.createdAt),
    index('contact_message_created_at_idx').on(table.createdAt),
    index('contact_message_email_idx').on(table.email),
  ],
);

/** Lifecycle of a newsletter subscription (see src/lib/newsletter.ts). */
export const NEWSLETTER_STATUSES = ['pending', 'confirmed', 'unsubscribed'] as const;
export type NewsletterStatus = (typeof NEWSLETTER_STATUSES)[number];

/**
 * Newsletter subscribers with double opt-in. A row is created as `pending` when the form is
 * submitted, becomes `confirmed` when the link in the confirmation email is opened and
 * `unsubscribed` when the link in a newsletter footer is used. The token in those links is a
 * random 256-bit value that only grants confirming or ending this one subscription; it is
 * stored as is (like Better Auth's verification tokens) so the owner can build unsubscribe
 * links for newsletters sent from outside the provider's audience.
 */
export const newsletterSubscribers = sqliteTable(
  'newsletter_subscriber',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    status: text('status', { enum: NEWSLETTER_STATUSES }).notNull().default('pending'),
    /** Confirm/unsubscribe token; rotated whenever a confirmation email is sent. */
    token: text('token').notNull().unique(),
    /** Where the form was submitted from (`footer`, `blog`, `page`), for the owner's curiosity. */
    source: text('source'),
    confirmationSentAt: integer('confirmation_sent_at', { mode: 'timestamp_ms' }),
    confirmedAt: integer('confirmed_at', { mode: 'timestamp_ms' }),
    unsubscribedAt: integer('unsubscribed_at', { mode: 'timestamp_ms' }),
    /** When the address was last pushed to the email provider's audience; null when never. */
    audienceSyncedAt: integer('audience_synced_at', { mode: 'timestamp_ms' }),
    /** Last error from the audience sync, cleared on success. */
    audienceError: text('audience_error'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    // The admin list filters by status, newest first; the retention job scans by status and age.
    index('newsletter_subscriber_status_updated_at_idx').on(table.status, table.updatedAt),
    index('newsletter_subscriber_created_at_idx').on(table.createdAt),
  ],
);

/**
 * Fixed-window counters used to throttle anonymous actions (see src/lib/throttle.ts).
 * Keys are hashed, so no raw addresses are stored.
 */
export const throttle = sqliteTable('throttle', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  resetAt: integer('reset_at', { mode: 'timestamp_ms' }).notNull(),
});

/** Record of privileged and privacy-relevant actions (see src/lib/admin.ts). */
export const auditLog = sqliteTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    actorId: text('actor_id'),
    actorEmail: text('actor_email'),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    /** JSON-encoded context, never secrets. */
    details: text('details'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index('audit_log_created_at_idx').on(table.createdAt)],
);
