/**
 * Seeds demo accounts for local development.
 *
 *   pnpm db:seed                      # demo@example.com and admin@example.com / password123
 *   SEED_EMAIL=me@x.dev SEED_PASSWORD=secret-pass pnpm db:seed
 *
 * Refuses to run against anything other than a `file:` database unless `--allow-remote` is
 * passed together with `SEED_PASSWORD`: the default accounts have a documented password and the
 * second one is an administrator, which must never land in a production database by accident.
 *
 * Talks to the database directly and hashes the password with Better Auth's own algorithm,
 * so no Astro or path-alias resolution is needed.
 */
import { hashPassword } from 'better-auth/crypto';

import { getDatabaseConfig } from '../src/lib/env.ts';

import { openDatabase } from './lib/db.ts';

const { url } = getDatabaseConfig();
const allowRemote = process.argv.includes('--allow-remote');
if (!url.startsWith('file:')) {
  if (!allowRemote) {
    console.error(
      `db:seed only seeds a local file database (DATABASE_URL is ${url.slice(0, url.indexOf(':') + 1)}//…). The demo accounts have a known password and one is an administrator. To seed a remote database on purpose, run it with --allow-remote and SEED_PASSWORD set.`,
    );
    process.exit(1);
  }
  if (!process.env.SEED_PASSWORD) {
    console.error('--allow-remote needs SEED_PASSWORD: the default password is public.');
    process.exit(1);
  }
}

const password = process.env.SEED_PASSWORD ?? 'password123';

const seeds = [
  {
    email: (process.env.SEED_EMAIL ?? 'demo@example.com').toLowerCase(),
    name: process.env.SEED_NAME ?? 'Demo User',
    role: 'user',
  },
  {
    email: (process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com').toLowerCase(),
    name: process.env.SEED_ADMIN_NAME ?? 'Demo Admin',
    role: 'admin',
  },
];

const client = openDatabase();

for (const seed of seeds) {
  const existing = await client.execute({
    sql: 'SELECT id FROM user WHERE email = ?',
    args: [seed.email],
  });
  if (existing.rows.length > 0) {
    console.log(`User ${seed.email} already exists; skipping.`);
    continue;
  }

  const now = Date.now();
  const userId = crypto.randomUUID();
  const hashed = await hashPassword(password);

  await client.batch(
    [
      {
        sql: 'INSERT INTO user (id, name, email, email_verified, image, role, banned, created_at, updated_at) VALUES (?, ?, ?, 1, NULL, ?, 0, ?, ?)',
        args: [userId, seed.name, seed.email, seed.role, now, now],
      },
      {
        sql: 'INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [crypto.randomUUID(), userId, 'credential', userId, hashed, now, now],
      },
    ],
    'write',
  );
  console.log(`Created ${seed.role} ${seed.email} (password: ${password}).`);
}

client.close();
