import { expect, test } from '@playwright/test';

import { E2E_PASSWORD, signIn, signUp, submitAccountDeletion, waitForIslands } from './helpers';

// Auth requests share one rate-limit bucket (same client IP); run them one at a time.
test.describe.configure({ mode: 'serial' });

test.describe('account self-service', () => {
  const email = `account-${Date.now()}@example.com`;

  test('exports the account data and deletes the account', async ({ page }) => {
    await signUp(page, 'Privacy Tester', email);
    await expect(page).toHaveURL(/\/dashboard$/);

    // Export (same browser context, so the session cookie is sent).
    const exported = await page.request.get('/api/account/export');
    expect(exported.status()).toBe(200);
    expect(exported.headers()['content-disposition']).toContain('attachment');
    const body = await exported.json();
    expect(body.user).toMatchObject({ email, name: 'Privacy Tester' });
    expect(body.accounts.map((a: { providerId: string }) => a.providerId)).toEqual(['credential']);
    expect(body.sessions.length).toBeGreaterThan(0);
    expect(JSON.stringify(body)).not.toMatch(/token|password/i);

    await submitAccountDeletion(page, E2E_PASSWORD);
    await expect(page).toHaveURL(/\/account-deleted$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('deleted');

    // The account is gone: the old credentials no longer work.
    await signIn(page, email);
    await expect(page.getByRole('alert')).toContainText(/invalid email or password/i);
  });

  test('explains when password reset is unavailable', async ({ page }) => {
    // The e2e server has no email provider, so the flow degrades with an explanation.
    await page.goto('/forgot-password');
    await expect(page.getByRole('status').filter({ hasText: 'Password reset' })).toContainText(
      'not available',
    );
    await expect(page.getByRole('link', { name: 'Back to sign in' })).toBeVisible();

    const reset = await page.goto('/reset-password');
    expect(reset?.status()).toBe(200);
    await expect(page.getByRole('alert')).toContainText('invalid or has expired');

    // With a token the form renders and there is still a way back without submitting.
    await page.goto('/reset-password?token=not-checked-until-submit');
    await waitForIslands(page);
    await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to sign in' })).toBeVisible();
  });

  test('rejects unauthenticated export requests', async ({ request }) => {
    const response = await request.get('/api/account/export');
    expect(response.status()).toBe(401);
  });
});
