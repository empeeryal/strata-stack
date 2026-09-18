import { expect, test, type Page } from '@playwright/test';

import { waitForIslands } from './helpers';

// Auth requests share one rate-limit bucket (same client IP); run them one at a time.
test.describe.configure({ mode: 'serial' });

const ADMIN_EMAIL = 'admin-e2e@example.com'; // listed in ADMIN_EMAILS (playwright.config.ts)
const PASSWORD = 'correct-horse-battery';

async function signUp(page: Page, name: string, email: string) {
  await page.goto('/signup');
  await waitForIslands(page);
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function sendContactMessage(page: Page, message: string, honeypot = false) {
  await page.goto('/contact');
  await waitForIslands(page);
  await page.getByLabel('Name').fill('Inbox Tester');
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

test.describe('admin area', () => {
  test('redirects anonymous visitors to the login page', async ({ request }) => {
    const response = await request.get('/admin', { maxRedirects: 0 });
    expect(response.status()).toBe(302);
    expect(response.headers()['location']).toContain('/login?next=%2Fadmin');
  });

  test('bootstraps the admin from ADMIN_EMAILS and manages the inbox', async ({ page }) => {
    const genuine = `Genuine question ${Date.now()}: does the template support Turso?`;
    const spam = `Spam attempt ${Date.now()}: this must never reach the inbox.`;

    await signUp(page, 'E2E Admin', ADMIN_EMAIL);
    await expect(page.getByRole('link', { name: 'Admin' }).first()).toBeVisible();

    await sendContactMessage(page, genuine);
    await sendContactMessage(page, spam, true);

    // Overview and inbox
    await page.goto('/admin');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Overview');

    await page.goto('/admin/messages');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Messages');
    await expect(page.getByText(genuine)).toBeVisible();
    await expect(page.getByText(spam)).toHaveCount(0);
    await expect(page.getByText('sent').first()).toBeVisible();

    // Opening a message marks it as read; archiving moves it out of the view.
    await page.getByRole('link', { name: 'Inbox Tester' }).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Message from Inbox Tester',
    );
    await expect(page.getByText(genuine)).toBeVisible();
    await expect(page.getByText('read', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Archive' }).click();
    await expect(page).toHaveURL(/\/admin\/messages\/[^/]+$/);
    await expect(page.getByText('archived', { exact: true })).toBeVisible();

    await page.goto('/admin/messages?status=archived');
    await expect(page.getByText(genuine)).toBeVisible();

    // Users and audit log
    await page.goto('/admin/users');
    const adminRow = page.getByRole('row').filter({ hasText: ADMIN_EMAIL });
    await expect(adminRow).toContainText('(you)');
    await expect(adminRow).toContainText('admin');

    await page.goto('/admin/audit');
    await expect(page.getByText('message.status').first()).toBeVisible();
  });

  test('hides the admin area from regular users', async ({ page }) => {
    await signUp(page, 'Regular User', `regular-${Date.now()}@example.com`);
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
});
