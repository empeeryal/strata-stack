import { defineConfig } from 'drizzle-kit';

// Load `.env` for CLI usage (Node ≥ 20.12). Silently ignore a missing file.
try {
  process.loadEnvFile?.();
} catch {
  /* no .env file */
}

// The `turso` dialect speaks libSQL: it accepts both `file:` URLs for local
// development and `libsql://` URLs for Turso in production.
export default defineConfig({
  dialect: 'turso',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'file:./.data/local.db',
    ...(process.env.DATABASE_AUTH_TOKEN ? { authToken: process.env.DATABASE_AUTH_TOKEN } : {}),
  },
  strict: true,
  verbose: true,
});
