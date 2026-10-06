import { expect, test } from '@playwright/test';

import { serverEnv } from '../../playwright.config';

import { E2E_PASSWORD, signUp, waitForIslands } from './helpers';

// Auth requests share one rate-limit bucket (same client IP); run them one at a time.
test.describe.configure({ mode: 'serial' });

test.describe('authentication', () => {
  test('sign up, visit the dashboard, sign out and sign back in', async ({ page }) => {
    const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;

    await signUp(page, 'E2E User', email);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hello, E2E User');
    // The account card; the email card below repeats the address.
    await expect(page.getByRole('definition').filter({ hasText: email })).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/$/);

    // The login page keeps the requested destination and returns there after signing in.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login\?next=(%2F|\/)dashboard$/);
    await waitForIslands(page);
    await page.getByLabel('Email').first().fill(email);
    await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('rejects wrong credentials', async ({ page }) => {
    await page.goto('/login');
    await waitForIslands(page);
    await page.getByLabel('Email').first().fill('nobody@example.com');
    await page.getByLabel('Password', { exact: true }).fill('definitely-wrong');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(/invalid email or password/i);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('refuses short passwords and passwords from known breaches', async ({ page, request }) => {
    // The length rule is enforced by the server for every client, not only by the form.
    const short = await request.post('/api/auth/sign-up/email', {
      data: { name: 'Short', email: `short-${Date.now()}@example.com`, password: 'only-eleven' },
    });
    expect(short.status()).toBe(400);

    // Long enough, but in every breach corpus: the check answers before the account exists.
    test.skip(
      serverEnv.PASSWORD_BREACH_CHECK === 'false',
      'PASSWORD_BREACH_CHECK=false: the breach check is off for this run',
    );
    await page.goto('/signup');
    await waitForIslands(page);
    await page.getByLabel('Name').fill('Breached');
    await page.getByLabel('Email', { exact: true }).fill(`breached-${Date.now()}@example.com`);
    await page.getByLabel('Password', { exact: true }).fill('password1234');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('alert')).toContainText(/known data breach/i);
    await expect(page).toHaveURL(/\/signup$/);
  });

  test('redirects anonymous visitors from the dashboard', async ({ request }) => {
    const dashboard = await request.get('/dashboard', { maxRedirects: 0 });
    expect(dashboard.status()).toBe(302);
    expect(dashboard.headers()['location']).toContain('/login');
  });

  test('server-rendered pages carry the refreshed session cookies', async ({
    request,
    playwright,
    baseURL,
  }) => {
    const signedUp = await request.post('/api/auth/sign-up/email', {
      data: {
        name: 'Cookie Tester',
        email: `cookies-${Date.now()}@example.com`,
        password: E2E_PASSWORD,
      },
    });
    expect(signedUp.ok()).toBe(true);
    const { cookies } = await request.storageState();
    const token = cookies.find((cookie) => cookie.name.endsWith('session_token'));
    expect(token).toBeDefined();

    // Only the session token, as a browser whose cookie cache has expired sends it: the
    // middleware reads the database and the response must carry the refreshed cache cookie, or
    // every later request would read the database again.
    const bare = await playwright.request.newContext({
      ...(baseURL ? { baseURL } : {}),
      storageState: { cookies: [token!], origins: [] },
    });
    try {
      const dashboard = await bare.get('/dashboard', { maxRedirects: 0 });
      expect(dashboard.status()).toBe(200);
      const setCookies = dashboard
        .headersArray()
        .filter((header) => header.name.toLowerCase() === 'set-cookie')
        .map((header) => header.value);
      expect(setCookies.some((value) => value.includes('session_data='))).toBe(true);
      // Personal responses are never stored by a cache in front of the server.
      expect(dashboard.headers()['cache-control']).toBe('private, no-store');
    } finally {
      await bare.dispose();
    }
  });
});
