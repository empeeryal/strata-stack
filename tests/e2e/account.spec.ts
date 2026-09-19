import { expect, test } from '@playwright/test';

import { waitForIslands } from './helpers';

// Auth requests share one rate-limit bucket (same client IP); run them one at a time.
test.describe.configure({ mode: 'serial' });

test.describe('account self-service', () => {
  const email = `account-${Date.now()}@example.com`;
  const password = 'correct-horse-battery';

  test('exports the account data and deletes the account', async ({ page }) => {
    await page.goto('/signup');
    await waitForIslands(page);
    await page.getByLabel('Name').fill('Privacy Tester');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();
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

    // Delete. The form hydrates on visibility, so bring it into view before waiting.
    await page.getByRole('button', { name: 'Delete my account' }).scrollIntoViewIfNeeded();
    await waitForIslands(page);
    await page.getByRole('button', { name: 'Delete my account' }).click();
    // The change-password form has a "Current password" field too; scope to the delete form.
    const deleteForm = page.getByRole('form', { name: 'Delete account' });
    await deleteForm.getByLabel('Current password').fill(password);
    await deleteForm.getByLabel('Type DELETE to confirm').fill('DELETE');
    await deleteForm.getByRole('button', { name: 'Permanently delete account' }).click();
    await expect(page).toHaveURL(/\/account-deleted$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('deleted');

    // The account is gone: the old credentials no longer work.
    await page.goto('/login');
    await waitForIslands(page);
    await page.getByLabel('Email').first().fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
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
    await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to sign in' })).toBeVisible();
  });

  test('rejects unauthenticated export requests', async ({ request }) => {
    const response = await request.get('/api/account/export');
    expect(response.status()).toBe(401);
  });
});
