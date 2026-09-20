import { defineConfig } from 'drizzle-kit';

import { getDatabaseConfig } from './src/lib/env';

// Load `.env` for CLI usage (Node ≥ 20.12). Silently ignore a missing file.
try {
  process.loadEnvFile?.();
} catch {
  /* no .env file */
}

const { url, authToken } = getDatabaseConfig();

// The `turso` dialect speaks libSQL: it accepts both `file:` URLs for local
// development and `libsql://` URLs for Turso in production.
export default defineConfig({
  dialect: 'turso',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: { url, ...(authToken ? { authToken } : {}) },
  strict: true,
  verbose: true,
});
