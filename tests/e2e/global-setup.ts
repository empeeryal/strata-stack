import { existsSync } from 'node:fs';

/**
 * Fails fast with a clear message when the Node build is missing. The e2e database is
 * reset and migrated by the web-server command in playwright.config.ts, because Playwright
 * starts the web server before this hook runs.
 */
export default function globalSetup() {
  if (!existsSync('dist/server/entry.mjs')) {
    throw new Error('No Node build found. Run `pnpm build:node` before `pnpm test:e2e`.');
  }
}
