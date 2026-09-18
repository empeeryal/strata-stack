import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the production build of the Node target:
 *
 *   pnpm build:node && pnpm test:e2e
 *
 * The web server uses an isolated SQLite database (.data/e2e.db) that is reset and
 * migrated by tests/e2e/global-setup.ts before every run.
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
    command: 'node ./dist/server/entry.mjs',
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
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
