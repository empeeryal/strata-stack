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

  test('lists sessions and signs out another one from the dashboard', async ({ page, browser }) => {
    const address = `sessions-${Date.now()}@example.com`;
    await signUp(page, 'Session Tester', address);
    await expect(page).toHaveURL(/\/dashboard$/);

    // A second device: the same account signed in from another browser context.
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await signIn(otherPage, address);
    await expect(otherPage).toHaveURL(/\/dashboard$/);

    await page.goto('/dashboard');
    await waitForIslands(page);
    const sessions = page.locator('[data-sessions] > li');
    await expect(sessions).toHaveCount(2);
    await expect(page.getByText('This device')).toHaveCount(1);

    // The island signs the other session out in place: same URL, a status message, one row.
    await page.locator('[data-sessions]').getByRole('button', { name: 'Sign out' }).click();
    await expect(page.locator('[data-sessions-status]')).toHaveText('That session was signed out.');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(sessions).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Sign out of other sessions' })).toHaveCount(0);

    // The other device's cached cookie no longer opens the dashboard.
    await otherPage.goto('/dashboard');
    await expect(otherPage).toHaveURL(/\/login\?next=(\/|%2F)dashboard$/);
    await other.close();
  });

  test('signs out other sessions without JavaScript through the form post', async ({
    page,
    browser,
  }) => {
    const address = `nojs-sessions-${Date.now()}@example.com`;
    await signUp(page, 'Form Tester', address);
    await expect(page).toHaveURL(/\/dashboard$/);
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await signIn(otherPage, address);
    await expect(otherPage).toHaveURL(/\/dashboard$/);

    // The same session, in a context without JavaScript: the island's forms post to the page.
    const noJs = await browser.newContext({
      javaScriptEnabled: false,
      storageState: await page.context().storageState(),
    });
    const plain = await noJs.newPage();
    await plain.goto('/dashboard');
    await expect(plain.locator('[data-sessions] > li')).toHaveCount(2);
    await plain.getByRole('button', { name: 'Sign out of other sessions' }).click();
    await expect(plain).toHaveURL(/\/dashboard\?notice=sessions-revoked$/);
    await expect(plain.locator('[data-account-notice]')).toHaveText(
      'Every other session was signed out.',
    );
    await expect(plain.locator('[data-sessions] > li')).toHaveCount(1);
    await otherPage.goto('/dashboard');
    await expect(otherPage).toHaveURL(/\/login\?next=(\/|%2F)dashboard$/);
    await noJs.close();
    await other.close();
  });

  test('edits the name and avatar from the dashboard', async ({ page }) => {
    const address = `profile-${Date.now()}@example.com`;
    await signUp(page, 'Profile Tester', address);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hello, Profile Tester');

    const form = page.getByRole('form', { name: 'Profile' });
    await form.scrollIntoViewIfNeeded();
    await waitForIslands(page);
    await form.getByLabel('Name').fill('  Ada   Lovelace ');
    await form.getByLabel('Avatar image URL').fill('https://github.com/octocat.png');
    await form.getByRole('button', { name: 'Save profile' }).click();

    await expect(page).toHaveURL(/\/dashboard\?notice=profile-updated$/);
    await expect(page.locator('[data-account-notice]')).toHaveText('Profile updated.');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hello, Ada Lovelace');
    await expect(page.locator('[data-profile-avatar]')).toHaveAttribute(
      'src',
      'https://github.com/octocat.png',
    );
    await expect(page.getByRole('link', { name: 'Ada Lovelace' }).first()).toBeVisible();

    // Prerendered pages learn the name and avatar from the session request.
    await page.goto('/about');
    const menu = page.locator('account-menu').first();
    await expect(menu.locator('[data-name]')).toHaveText('Ada Lovelace');
    await expect(menu.locator('[data-avatar] img')).toHaveAttribute(
      'src',
      'https://github.com/octocat.png',
    );

    // The API enforces the same rules for clients that skip the form.
    const rejected = await page.request.post('/api/auth/update-user', {
      data: { image: 'http://example.com/avatar.png' },
    });
    expect(rejected.status()).toBe(400);
    expect((await rejected.json()).message).toContain('https://');
    // A link that no longer loads falls back to the initials.
    await page.route('https://github.com/octocat.png', (route) => route.abort());
    await page.goto('/dashboard');
    await expect(page.locator('[data-profile-avatar]')).toHaveText('AL');
    await page.unroute('https://github.com/octocat.png');

    const cleared = await page.request.post('/api/auth/update-user', { data: { image: '' } });
    expect(cleared.status()).toBe(200);
    await page.goto('/dashboard');
    await expect(page.locator('[data-profile-avatar]')).toHaveText('AL');
  });

  test('rejects unauthenticated export requests', async ({ request }) => {
    const response = await request.get('/api/account/export');
    expect(response.status()).toBe(401);
  });
});
