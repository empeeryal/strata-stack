/**
 * Seeds a demo user for local development.
 *
 *   pnpm db:seed                      # creates demo@example.com / password123
 *   SEED_EMAIL=me@x.dev SEED_PASSWORD=secret-pass pnpm db:seed
 *
 * Talks to the database directly with @libsql/client and hashes the password with
 * Better Auth's own algorithm, so no Astro or path-alias resolution is needed.
 */
import { createClient } from '@libsql/client';
import { hashPassword } from 'better-auth/crypto';

const url = process.env.DATABASE_URL ?? 'file:./.data/local.db';
const authToken = process.env.DATABASE_AUTH_TOKEN;
const email = (process.env.SEED_EMAIL ?? 'demo@example.com').toLowerCase();
const password = process.env.SEED_PASSWORD ?? 'password123';
const name = process.env.SEED_NAME ?? 'Demo User';

const client = createClient(authToken ? { url, authToken } : { url });

const existing = await client.execute({
  sql: 'SELECT id FROM user WHERE email = ?',
  args: [email],
});
if (existing.rows.length > 0) {
  console.log(`User ${email} already exists; nothing to do.`);
  process.exit(0);
}

const now = Date.now();
const userId = crypto.randomUUID();
const hashed = await hashPassword(password);

await client.batch(
  [
    {
      sql: 'INSERT INTO user (id, name, email, email_verified, image, created_at, updated_at) VALUES (?, ?, ?, 1, NULL, ?, ?)',
      args: [userId, name, email, now, now],
    },
    {
      sql: 'INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [crypto.randomUUID(), userId, 'credential', userId, hashed, now, now],
    },
  ],
  'write',
);

console.log(`Created ${email} (password: ${password}).`);
client.close();
