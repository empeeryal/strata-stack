import { createClient } from '@libsql/client';

/** libSQL client for DATABASE_URL (default: the local file database), with the Turso token when set. */
export function openDatabase() {
  const url = process.env.DATABASE_URL ?? 'file:./.data/local.db';
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  return createClient(authToken ? { url, authToken } : { url });
}
