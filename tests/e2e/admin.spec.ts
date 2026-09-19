import { expect, test, type Page } from '@playwright/test';

import { serverEnv } from '../../playwright.config';
import { E2E_PASSWORD, fillContactForm, signIn, signUp, submitAccountDeletion } from './helpers';

// Auth requests share one rate-limit bucket (same client IP); run them one at a time.
// Every test gets its own browser context, so each one signs in explicitly.
test.describe.configure({ mode: 'serial' });

const [ADMIN_EMAIL, SECOND_ADMIN_EMAIL] = serverEnv.ADMIN_EMAILS.split(',') as [string, string];
const HEALTH_TOKEN = serverEnv.HEALTH_TOKEN;

async function sendContactMessage(page: Page, name: string, message: string, honeypot = false) {
  await fillContactForm(page, { name, message, honeypot });
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

  // Both addresses are listed in ADMIN_EMAILS, so they get the admin role on sign-up.
  test.beforeAll(async ({ request }) => {
    for (const [name, email] of [
      ['E2E Admin', ADMIN_EMAIL],
      ['Second Admin', SECOND_ADMIN_EMAIL],
    ]) {
      const response = await request.post('/api/auth/sign-up/email', {
        data: { name, email, password: E2E_PASSWORD },
      });
      expect([200, 422]).toContain(response.status()); // 422: already exists from a retry
    }
  });

  test('redirects anonymous visitors to the login page', async ({ request }) => {
    const response = await request.get('/admin', { maxRedirects: 0 });
    expect(response.status()).toBe(302);
    expect(response.headers()['location']).toContain('/login?next=%2Fadmin');
  });

  test('manages the inbox', async ({ page }) => {
    const genuine = `Genuine question ${Date.now()}: does the template support Turso?`;
    const spam = `Spam attempt ${Date.now()}: this must never reach the inbox.`;

    await signIn(page, ADMIN_EMAIL);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('link', { name: 'Admin' }).first()).toBeVisible();

    await sendContactMessage(page, sender, genuine);
    await sendContactMessage(page, sender, spam, true);

    await page.goto('/admin');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Overview');

    await page.goto('/admin/messages');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Messages');
    await expect(page.getByText(genuine)).toBeVisible();
    await expect(page.getByText(spam)).toHaveCount(0);
    await expect(page.getByText('Sent').first()).toBeVisible();

    // Search narrows the list by sender name or address.
    await page.goto(`/admin/messages?status=new&q=${encodeURIComponent(sender)}`);
    await expect(page.locator('[data-list-summary]')).toHaveText(/Showing 1–1 of 1/);
    await expect(page.getByText(genuine)).toBeVisible();

    // Listing is a plain GET and must not touch the message: even after link prefetching
    // has run, the message is still new.
    await page.waitForLoadState('networkidle');
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
    await expect(page.locator('[data-message-status]')).toHaveText('Read');
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
    await expect(page.locator('[data-message-status]')).toHaveText('Archived');

    await page.goto(`/admin/messages?status=archived&q=${encodeURIComponent(sender)}`);
    await expect(page.getByText(genuine)).toBeVisible();

    await page.goto('/admin/users');
    await expect(userRow(page, ADMIN_EMAIL)).toContainText('(you)');
    await expect(userRow(page, ADMIN_EMAIL)).toContainText('Admin');

    await page.goto('/admin/audit');
    await expect(page.getByText('message.status').first()).toBeVisible();
  });

  test('the last administrator cannot delete their own account', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL);
    await expect(page).toHaveURL(/\/dashboard$/);

    // Make this account the only administrator.
    await page.goto('/admin/users');
    while ((await page.getByRole('button', { name: 'Remove admin' }).count()) > 0) {
      await page.getByRole('button', { name: 'Remove admin' }).first().click();
      await expect(notice(page)).toHaveText('Role updated.');
    }

    await page.goto('/dashboard');
    const form = await submitAccountDeletion(page);
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
    expect(anonymous.version).toBeUndefined();

    await signIn(page, ADMIN_EMAIL);
    await expect(page).toHaveURL(/\/dashboard$/);
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
    await signUp(page, 'Regular User', `regular-${Date.now()}@example.com`);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);

    const response = await page.goto('/admin');
    expect(response?.status()).toBe(404);

    // Actions are authorized independently of the pages.
    const forbidden = await page.request.post('/_actions/admin.deleteMessage', {
      form: { id: 'anything' },
      headers: { Origin: new URL(page.url()).origin },
    });
    expect(forbidden.status()).toBe(403);
  });

  test('role changes take effect on the next request', async ({ page, browser }) => {
    await signIn(page, ADMIN_EMAIL);
    await expect(page).toHaveURL(/\/dashboard$/);

    // Restore the second admin's role (the last-admin test above removed it).
    await page.goto('/admin/users');
    await userRow(page, SECOND_ADMIN_EMAIL).getByRole('button', { name: 'Make admin' }).click();
    await expect(notice(page)).toHaveText('Role updated.');

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await signIn(otherPage, SECOND_ADMIN_EMAIL);
    await expect(otherPage).toHaveURL(/\/dashboard$/);

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

    // The users page offers no controls for oneself, so the last admin cannot be removed.
    await expect(userRow(otherPage, SECOND_ADMIN_EMAIL)).toContainText('(you)');
    await expect(userRow(otherPage, SECOND_ADMIN_EMAIL).getByRole('button')).toHaveCount(0);

    // Promotion is just as immediate.
    await userRow(otherPage, ADMIN_EMAIL).getByRole('button', { name: 'Make admin' }).click();
    await expect(notice(otherPage)).toHaveText('Role updated.');
    expect((await page.goto('/admin'))?.status()).toBe(200);

    await other.close();
  });

  test('shows the signed-in state on prerendered pages', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL);
    await expect(page).toHaveURL(/\/dashboard$/);

    // The home page is static; the header resolves the session after the page loads.
    await page.goto('/');
    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: 'E2E Admin' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Admin', exact: true })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Sign in' })).toHaveCount(0);
  });
});
