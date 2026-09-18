/** Removes build output and caches. */
import { rmSync } from 'node:fs';

const targets = [
  'dist',
  '.astro',
  '.vercel/output',
  '.netlify',
  '.wrangler',
  'node_modules/.astro',
  'node_modules/.vite',
  'coverage',
  'playwright-report',
  'test-results',
];

for (const target of targets) {
  rmSync(target, { recursive: true, force: true });
  console.log(`removed ${target}`);
}
