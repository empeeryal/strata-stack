import { createClient } from '@libsql/client';

import { getDatabaseConfig } from '../../src/lib/env.ts';

/** libSQL client for the configured database (default: the local file), with the auth token when set. */
export function openDatabase() {
  const { url, authToken } = getDatabaseConfig();
  return createClient(authToken ? { url, authToken } : { url });
}
