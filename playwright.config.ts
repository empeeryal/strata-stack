import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the production build of the Node target:
 *
 *   pnpm build:node && pnpm test:e2e
 *
 * The web server command first resets and migrates an isolated SQLite database
 * (.data/e2e.db) and then starts the built server, so the schema exists before the first
 * request. Playwright launches the web server *before* `globalSetup`, which is why the reset
 * lives in the command rather than in tests/e2e/global-setup.ts. Set E2E_BASE_URL to run the
 * suite against a server that is already running elsewhere.
 *
 * The server binds 127.0.0.1 (a runner's `localhost` may resolve to IPv6 first), but the browser
 * visits it as `localhost`: WebAuthn needs a hostname as the relying party, and an IP address
 * is not one (tests/e2e/passkeys.spec.ts). Chrome and Node fall back to IPv4 for `localhost`.
 */
const PORT = Number(process.env.E2E_PORT ?? 4321);
const externalBaseUrl = process.env.E2E_BASE_URL;
const baseURL = externalBaseUrl ?? `http://localhost:${PORT}`;

export const serverEnv = {
  HOST: '127.0.0.1',
  PORT: String(PORT),
  NODE_ENV: 'test',
  DATABASE_URL: 'file:./.data/e2e.db',
  BETTER_AUTH_SECRET: 'e2e-only-secret-never-use-in-production-0123456789',
  BETTER_AUTH_URL: baseURL,
  // Accounts created with these addresses get the admin role. The admin spec uses the first two
  // (and demotes and signs them out); the accessibility spec, which may run in another worker at
  // the same time, has the third to itself. Its address must not contain the others: the admin
  // spec finds table rows by the substring of an address.
  ADMIN_EMAILS: 'admin-e2e@example.com,admin2-e2e@example.com,axe-e2e@example.com',
  // Notifications are "sent" to the console in test mode, so delivery shows as sent.
  CONTACT_TO_EMAIL: 'owner@example.com',
  // Unlocks the detailed /api/health response without an admin session.
  HEALTH_TOKEN: 'e2e-health-token',
  // Every sign-up asks Have I Been Pwned whether the password is known. Set it to `false` to run
  // the suite offline; the one test that needs the live answer skips itself.
  PASSWORD_BREACH_CHECK: process.env.PASSWORD_BREACH_CHECK ?? 'true',
  // Signing secret for the newsletter webhook test (tests/e2e/newsletter.spec.ts). Built at
  // run time so the committed source never contains a string shaped like a real credential.
  RESEND_WEBHOOK_SECRET: `whsec_${Buffer.from('e2e-webhook-secret-0123456789').toString('base64')}`,
};

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // Retries exist for the trace they capture, not to paper over a flaky test: a test that passes
  // only on a retry fails the CI run, so flakiness is fixed where it starts instead of eroding
  // the suite. Locally there is no retry; a failure is a failure.
  retries: process.env.CI ? 2 : 0,
  failOnFlakyTests: Boolean(process.env.CI),
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
  ...(externalBaseUrl
    ? {}
    : {
        webServer: {
          command: 'node scripts/reset-db.ts && node ./dist/server/entry.mjs',
          url: `${baseURL}/api/health`,
          // Always start fresh so the reset above runs on every invocation.
          reuseExistingServer: false,
          timeout: 60_000,
          env: serverEnv,
        },
      }),
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /admin\.spec\.ts/ },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: /(home|docs|blog)\.spec\.ts/,
    },
    // The admin spec changes global state (it makes one account the last administrator), which
    // would demote the administrator the accessibility suite signs in with. It runs after every
    // other spec has finished instead of alongside them.
    {
      name: 'admin',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /admin\.spec\.ts/,
      dependencies: ['chromium'],
    },
  ],
});
