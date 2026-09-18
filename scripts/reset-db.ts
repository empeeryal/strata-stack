/**
 * Deletes the local SQLite database and re-applies all migrations.
 * Refuses to run against anything other than a `file:` URL.
 */
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';

const url = process.env.DATABASE_URL ?? 'file:./.data/local.db';
if (!url.startsWith('file:')) {
  console.error(`Refusing to reset a non-local database (${url}).`);
  process.exit(1);
}

const path = url.slice('file:'.length);
for (const suffix of ['', '-journal', '-shm', '-wal']) {
  rmSync(`${path}${suffix}`, { force: true });
}
console.log(`Removed ${path}`);

const result = spawnSync('pnpm', ['db:migrate'], { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
