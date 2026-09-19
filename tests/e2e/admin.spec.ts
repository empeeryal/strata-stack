import { expect, test, type Page } from '@playwright/test';

import { waitForIslands } from './helpers';

// Auth requests share one rate-limit bucket (same client IP); run them one at a time.
// Every test gets its own browser context, so each one signs in explicitly.
test.describe.configure({ mode: 'serial' });

// Both addresses are listed in ADMIN_EMAILS (playwright.config.ts).
const ADMIN_EMAIL = 'admin-e2e@example.com';
const SECOND_ADMIN_EMAIL = 'admin2-e2e@example.com';
const PASSWORD = 'correct-horse-battery';
const HEALTH_TOKEN = 'e2e-health-token';

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await waitForIslands(page);
  await page.getByLabel('Email').first().fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** Signs up, or signs in when the account already exists (serial retries reuse the database). */
async function ensureAccount(page: Page, name: string, email: string) {
  await page.goto('/signup');
  await waitForIslands(page);
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();

  const alert = page.getByRole('alert');
  const outcome = await Promise.race([
    page.waitForURL(/\/dashboard$/).then(
      () => 'signed-up' as const,
      () => 'timeout' as const,
    ),
    alert.waitFor().then(
      () => 'exists' as const,
      () => 'timeout' as const,
    ),
  ]);
  if (outcome === 'exists') {
    await expect(alert).toContainText(/already exists/i);
    await signIn(page, email);
  } else {
    expect(outcome).toBe('signed-up');
  }
}

async function sendContactMessage(page: Page, sender: string, message: string, honeypot = false) {
  await page.goto('/contact');
  await waitForIslands(page);
  await page.getByLabel('Name').fill(sender);
  await page.getByLabel('Email').fill(`inbox-${Date.now()}@example.com`);
  await page.getByLabel('Message').fill(message);
  if (honeypot) {
    await page.evaluate(() => {
      const field = document.querySelector<HTMLInputElement>('input[name="website"]');
      if (field) field.value = 'https://spam.example';
    });
  }
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'your message' })).toContainText(
    'has been received',
  );
}

/** The confirmation the admin layout shows after a successful action. */
function notice(page: Page) {
  return page.locator('[data-admin-notice]');
}

/** Row of the users table for an account. */
function userRow(page: Page, email: string) {
  return page.getByRole('row').filter({ hasText: email });
}

test.describe('admin area', () => {
  // Unique per run so retries and the parallel contact spec never affect the counts below.
  const sender = `Inbox Tester ${Date.now()}`;

  test('redirects anonymous visitors to the login page', async ({ request }) => {
    const response = await request.get('/admin', { maxRedirects: 0 });
    expect(response.status()).toBe(302);
    expect(response.headers()['location']).toContain('/login?next=%2Fadmin');
  });

  test('bootstraps the admin from ADMIN_EMAILS and manages the inbox', async ({ page }) => {
    const genuine = `Genuine question ${Date.now()}: does the template support Turso?`;
    const spam = `Spam attempt ${Date.now()}: this must never reach the inbox.`;

    await ensureAccount(page, 'E2E Admin', ADMIN_EMAIL);
    await expect(page.getByRole('link', { name: 'Admin' }).first()).toBeVisible();

    await sendContactMessage(page, sender, genuine);
    await sendContactMessage(page, sender, spam, true);

    // Overview and inbox
    await page.goto('/admin');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Overview');

    await page.goto('/admin/messages');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Messages');
    await expect(page.getByText(genuine)).toBeVisible();
    await expect(page.getByText(spam)).toHaveCount(0);
    await expect(page.getByText('sent').first()).toBeVisible();

    // Search narrows the list by sender name or address.
    await page.goto(`/admin/messages?status=new&q=${encodeURIComponent(sender)}`);
    await expect(page.locator('[data-list-summary]')).toHaveText(/Showing 1–1 of 1/);
    await expect(page.getByText(genuine)).toBeVisible();

    // Listing is a plain GET and must not touch the message: even after link prefetching
    // had time to run, the message is still new.
    await page.waitForTimeout(1500);
    await page.reload();
    await expect(page.locator('[data-list-summary]')).toHaveText(/Showing 1–1 of 1/);
    await expect(page.getByRole('link', { name: sender })).toBeVisible();

    await page.goto('/admin/messages?q=nobody-with-this-name');
    await expect(page.locator('[data-list-summary]')).toContainText('No messages match');

    // Opening the message marks it read through the audited action.
    await page.goto(`/admin/messages?q=${encodeURIComponent(sender)}`);
    await page.getByRole('link', { name: sender }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(`Message from ${sender}`);
    await expect(page.getByText(genuine)).toBeVisible();
    await expect(page.locator('[data-message-status]')).toHaveText('read');
    await expect(page.getByRole('button', { name: 'Mark as unread' })).toBeVisible();

    // Mark as unread returns to the inbox with a confirmation; the message is new again.
    await page.getByRole('button', { name: 'Mark as unread' }).click();
    await expect(page).toHaveURL(/\/admin\/messages\?/);
    await expect(notice(page)).toHaveText('Message marked as unread.');
    await page.goto(`/admin/messages?status=new&q=${encodeURIComponent(sender)}`);
    await expect(page.locator('[data-list-summary]')).toHaveText(/Showing 1–1 of 1/);

    // Archive from the detail page.
    await page.getByRole('link', { name: sender }).click();
    await page.getByRole('button', { name: 'Archive' }).click();
    await expect(page).toHaveURL(/\/admin\/messages\/[^/?]+\?notice=message-archived$/);
    await expect(notice(page)).toHaveText('Message archived.');
    await expect(page.locator('[data-message-status]')).toHaveText('archived');

    await page.goto(`/admin/messages?status=archived&q=${encodeURIComponent(sender)}`);
    await expect(page.getByText(genuine)).toBeVisible();

    // Users and audit log
    await page.goto('/admin/users');
    await expect(userRow(page, ADMIN_EMAIL)).toContainText('(you)');
    await expect(userRow(page, ADMIN_EMAIL)).toContainText('admin');

    await page.goto('/admin/audit');
    await expect(page.getByText('message.status').first()).toBeVisible();
  });

  test('the last administrator cannot delete their own account', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL);

    // Make this account the only administrator (a retry may have created another one).
    await page.goto('/admin/users');
    while ((await page.getByRole('button', { name: 'Remove admin' }).count()) > 0) {
      await page.getByRole('button', { name: 'Remove admin' }).first().click();
      await expect(notice(page)).toHaveText('Role updated.');
    }

    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Delete my account' }).scrollIntoViewIfNeeded();
    await waitForIslands(page);
    await page.getByRole('button', { name: 'Delete my account' }).click();
    const form = page.getByRole('form', { name: 'Delete account' });
    await form.getByLabel('Current password').fill(PASSWORD);
    await form.getByLabel('Type DELETE to confirm').fill('DELETE');
    await form.getByRole('button', { name: 'Permanently delete account' }).click();
    await expect(form.getByRole('alert')).toContainText('only administrator');
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('reveals health details only to administrators or with the token', async ({
    page,
    request,
  }) => {
    const anonymous = await (await request.get('/api/health')).json();
    expect(anonymous.status).toBe('ok');
    expect(anonymous.checks).toBeUndefined();

    await signIn(page, ADMIN_EMAIL);
    const asAdmin = await (await page.request.get('/api/health')).json();
    expect(asAdmin.checks).toMatchObject({ database: 'ok' });
    expect(asAdmin.target).toBe('node');

    const withToken = await request.get('/api/health', {
      headers: { Authorization: `Bearer ${HEALTH_TOKEN}` },
    });
    expect((await withToken.json()).checks).toMatchObject({ database: 'ok' });

    const wrongToken = await request.get('/api/health', {
      headers: { Authorization: 'Bearer nope' },
    });
    expect((await wrongToken.json()).checks).toBeUndefined();
  });

  test('hides the admin area from regular users', async ({ page }) => {
    await ensureAccount(page, 'Regular User', `regular-${Date.now()}@example.com`);
    await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);

    const response = await page.goto('/admin');
    expect(response?.status()).toBe(404);

    // Actions are authorized independently of the pages.
    const forbidden = await page.request.post('/_actions/admin.deleteMessage', {
      form: { id: 'anything' },
      headers: { Origin: new URL(page.url()).origin },
    });
    expect([401, 403]).toContain(forbidden.status());
  });

  test('role changes take effect on the next request', async ({ page, browser }) => {
    await signIn(page, ADMIN_EMAIL);

    // A second administrator signs up in a separate browser (ADMIN_EMAILS grants the role;
    // the previous test may have removed it on a retry, so restore it if needed).
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await ensureAccount(otherPage, 'Second Admin', SECOND_ADMIN_EMAIL);
    await page.goto('/admin/users');
    const promote = userRow(page, SECOND_ADMIN_EMAIL).getByRole('button', { name: 'Make admin' });
    if ((await promote.count()) > 0) {
      await promote.click();
      await expect(notice(page)).toHaveText('Role updated.');
    }

    // The first admin has access and a freshly cached session cookie.
    expect((await page.goto('/admin'))?.status()).toBe(200);

    // The second admin removes the first admin's role.
    await otherPage.goto('/admin/users');
    await userRow(otherPage, ADMIN_EMAIL).getByRole('button', { name: 'Remove admin' }).click();
    await expect(notice(otherPage)).toHaveText('Role updated.');

    // Despite the cookie cache, the very next request by the first admin is refused.
    expect((await page.goto('/admin'))?.status()).toBe(404);
    const forbidden = await page.request.post('/_actions/admin.deleteMessage', {
      form: { id: 'anything' },
      headers: { Origin: new URL(page.url()).origin },
    });
    expect(forbidden.status()).toBe(403);

    // The second admin is now the last one; the users page offers no controls for oneself.
    await expect(userRow(otherPage, SECOND_ADMIN_EMAIL)).toContainText('(you)');
    await expect(userRow(otherPage, SECOND_ADMIN_EMAIL).getByRole('button')).toHaveCount(0);

    // Promotion is just as immediate, which also restores the state for retries.
    await userRow(otherPage, ADMIN_EMAIL).getByRole('button', { name: 'Make admin' }).click();
    await expect(notice(otherPage)).toHaveText('Role updated.');
    expect((await page.goto('/admin'))?.status()).toBe(200);

    await other.close();
  });
});
