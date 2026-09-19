import { existsSync } from 'node:fs';

/** Fails fast when the Node build is missing. */
export default function globalSetup() {
  if (!existsSync('dist/server/entry.mjs')) {
    throw new Error('No Node build found. Run `pnpm build:node` before `pnpm test:e2e`.');
  }
}
