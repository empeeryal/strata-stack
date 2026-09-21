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
