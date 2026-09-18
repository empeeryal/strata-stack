import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the production build of the Node target:
 *
 *   pnpm build:node && pnpm test:e2e
 *
 * The web server command first resets and migrates an isolated SQLite database
 * (.data/e2e.db) and then starts the built server, so the schema exists before the first
 * request. Playwright launches the web server *before* `globalSetup`, which is why the reset
 * lives in the command rather than in tests/e2e/global-setup.ts.
 */
const PORT = Number(process.env.E2E_PORT ?? 4321);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export const serverEnv = {
  HOST: '127.0.0.1',
  PORT: String(PORT),
  NODE_ENV: 'test',
  DATABASE_URL: 'file:./.data/e2e.db',
  BETTER_AUTH_SECRET: 'e2e-only-secret-never-use-in-production-0123456789',
  BETTER_AUTH_URL: baseURL,
};

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  ...(process.env.CI ? { workers: 2 } : {}),
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } }
      : {}),
  },
  webServer: {
    // Reset + migrate the e2e database, then start the built server (both get `env`).
    command: 'node scripts/reset-db.ts && node ./dist/server/entry.mjs',
    url: `${baseURL}/api/health`,
    // Always start a fresh server so the reset above runs on every invocation and a stray
    // `astro dev` on the same port is never tested by mistake.
    reuseExistingServer: false,
    timeout: 60_000,
    env: serverEnv,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: /(home|docs|blog)\.spec\.ts/,
    },
  ],
});
