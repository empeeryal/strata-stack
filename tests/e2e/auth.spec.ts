import { expect, test } from '@playwright/test';

import { waitForIslands } from './helpers';

// Auth requests share one rate-limit bucket (same client IP); run them one at a time.
test.describe.configure({ mode: 'serial' });

test.describe('authentication', () => {
  test('sign up, visit the dashboard, sign out and sign back in', async ({ page }) => {
    const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
    const password = 'correct-horse-battery';

    await page.goto('/signup');
    await waitForIslands(page);
    await page.getByLabel('Name').fill('E2E User');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hello, E2E User');
    await expect(page.getByText(email)).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login\?next=(%2F|\/)dashboard$/);
    await waitForIslands(page);

    await page.getByLabel('Email').first().fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('rejects wrong credentials', async ({ page }) => {
    await page.goto('/login');
    await waitForIslands(page);
    await page.getByLabel('Email').first().fill('nobody@example.com');
    await page.getByLabel('Password', { exact: true }).fill('definitely-wrong');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toContainText(/invalid email or password/i);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('protected routes redirect and API health responds', async ({ request }) => {
    const dashboard = await request.get('/dashboard', { maxRedirects: 0 });
    expect(dashboard.status()).toBe(302);
    expect(dashboard.headers()['location']).toContain('/login');

    // Anonymous callers get liveness only; the configuration details need an admin session
    // or HEALTH_TOKEN (see tests/e2e/admin.spec.ts).
    const health = await request.get('/api/health');
    const body = await health.json();
    expect(body).toMatchObject({ status: 'ok' });
    expect(body.checks).toBeUndefined();
    expect(body.version).toBeUndefined();
  });
});
