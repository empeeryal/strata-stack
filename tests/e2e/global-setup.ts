import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

import { serverEnv } from '../../playwright.config';

/** Fresh, migrated SQLite database for every e2e run. */
export default function globalSetup() {
  if (!existsSync('dist/server/entry.mjs')) {
    throw new Error('No Node build found. Run `pnpm build:node` before `pnpm test:e2e`.');
  }

  const file = serverEnv.DATABASE_URL.replace(/^file:/, '');
  for (const suffix of ['', '-journal', '-shm', '-wal'])
    rmSync(`${file}${suffix}`, { force: true });

  const result = spawnSync('pnpm', ['exec', 'drizzle-kit', 'migrate'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, DATABASE_URL: serverEnv.DATABASE_URL },
  });
  if (result.status !== 0) {
    throw new Error('Failed to migrate the e2e database.');
  }
}
