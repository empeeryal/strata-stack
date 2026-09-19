import { expect, test } from '@playwright/test';

import { fillContactForm, waitForIslands } from './helpers';

test.describe('contact form', () => {
  test('stores a message and confirms receipt without promising a reply', async ({ page }) => {
    await fillContactForm(page, {
      name: 'E2E Sender',
      message: 'Hello from the end-to-end suite, this is a real message.',
    });
    await page.getByRole('button', { name: 'Send message' }).click();

    const status = page.getByRole('status').filter({ hasText: 'your message' });
    await expect(status).toContainText('has been received');
    await expect(status).not.toContainText('has been sent');
  });

  test('answers a filled honeypot with the same success message', async ({ page }) => {
    await fillContactForm(page, {
      name: 'E2E Sender',
      message: 'Buy cheap watches now, this is definitely not spam at all.',
      honeypot: true,
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
