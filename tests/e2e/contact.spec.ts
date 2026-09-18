import { expect, test, type Page } from '@playwright/test';

import { waitForIslands } from './helpers';

async function fillContactForm(page: Page, message: string) {
  await page.goto('/contact');
  await waitForIslands(page);
  await page.getByLabel('Name').fill('E2E Sender');
  await page.getByLabel('Email').fill(`contact-${Date.now()}@example.com`);
  await page.getByLabel('Message').fill(message);
}

test.describe('contact form', () => {
  test('stores a message and confirms receipt without promising a reply', async ({ page }) => {
    await fillContactForm(page, 'Hello from the end-to-end suite, this is a real message.');
    await page.getByRole('button', { name: 'Send message' }).click();

    const status = page.getByRole('status').filter({ hasText: 'your message' });
    await expect(status).toContainText('has been received');
    await expect(status).not.toContainText('has been sent');
  });

  test('answers a filled honeypot with the same success message', async ({ page }) => {
    await fillContactForm(page, 'Buy cheap watches now, this is definitely not spam at all.');
    // The field is off-screen for people; bots fill it programmatically.
    await page.evaluate(() => {
      const field = document.querySelector<HTMLInputElement>('input[name="website"]');
      if (field) field.value = 'https://spam.example';
    });
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(page.getByRole('status').filter({ hasText: 'your message' })).toContainText(
      'has been received',
    );
  });

  test('rejects invalid input with field errors', async ({ page }) => {
    await page.goto('/contact');
    await waitForIslands(page);
    await page.getByLabel('Name').fill('E2E Sender');
    await page.getByLabel('Email').fill('valid@example.com');
    await page.getByLabel('Message').fill('too short');
    // Bypass native validation to exercise the server-side response.
    await page.evaluate(() => document.querySelector('form')?.setAttribute('novalidate', ''));
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(page.getByRole('alert')).toContainText('highlighted fields');
    await expect(page.getByLabel('Message')).toHaveAttribute('aria-invalid', 'true');
  });
});
