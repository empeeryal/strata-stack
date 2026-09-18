import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Messages submitted through the contact form (see src/actions/index.ts). */
export const contactMessages = sqliteTable('contact_message', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  message: text('message').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});
