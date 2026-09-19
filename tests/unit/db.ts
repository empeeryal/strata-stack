import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

import * as schema from '@/db/schema';

const migrationsFolder = new URL('../../drizzle', import.meta.url).pathname;

/**
 * In-memory SQLite database with the real migrations applied, for unit tests that
 * exercise persistence (contact flow, throttling, audit log).
 */
export async function createTestDb() {
  const client = createClient({ url: ':memory:' });
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder });
  return { db, close: () => client.close() };
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>['db'];
