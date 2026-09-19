import { expect, test } from '@playwright/test';

import { E2E_PASSWORD, signUp, waitForIslands } from './helpers';

// Auth requests share one rate-limit bucket (same client IP); run them one at a time.
test.describe.configure({ mode: 'serial' });

test.describe('authentication', () => {
  test('sign up, visit the dashboard, sign out and sign back in', async ({ page }) => {
    const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;

    await signUp(page, 'E2E User', email);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hello, E2E User');
    await expect(page.getByText(email)).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/$/);

    // The login page keeps the requested destination and returns there after signing in.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login\?next=(%2F|\/)dashboard$/);
    await waitForIslands(page);
    await page.getByLabel('Email').first().fill(email);
    await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD);
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

  test('redirects anonymous visitors from the dashboard', async ({ request }) => {
    const dashboard = await request.get('/dashboard', { maxRedirects: 0 });
    expect(dashboard.status()).toBe(302);
    expect(dashboard.headers()['location']).toContain('/login');
  });
});
