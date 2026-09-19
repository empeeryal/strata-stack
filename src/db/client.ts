import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

import * as schema from './schema/index';

/**
 * libSQL connection shared by Better Auth, actions and API routes.
 *
 * - Development: `file:./.data/local.db` (created by `pnpm db:migrate`).
 * - Production: `libsql://<db>.turso.io` + DATABASE_AUTH_TOKEN.
 *
 * `@libsql/client` resolves to its HTTP build on Cloudflare Workers, Netlify and edge
 * runtimes through package export conditions, so this file works unchanged everywhere.
 */
const url = process.env.DATABASE_URL ?? 'file:./.data/local.db';
const authToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient(authToken ? { url, authToken } : { url });

if (url.startsWith('file:')) {
  // Local SQLite: WAL allows concurrent readers while a writer is active, and the busy
  // timeout makes parallel requests (e.g. two API calls at once) wait for the lock
  // instead of failing with SQLITE_BUSY. Turso applies equivalent settings server-side.
  void client
    .executeMultiple('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;')
    .catch((error: unknown) => console.warn('[db] could not apply SQLite pragmas', error));
}

export const db = drizzle({ client, schema });

export type Database = typeof db;

/**
 * Either the database or a transaction handle. Helpers that must take part in a caller's
 * transaction (e.g. `writeAudit`) accept this instead of `Database`.
 */
export type DbExecutor = Pick<Database, 'select' | 'insert' | 'update' | 'delete'>;
