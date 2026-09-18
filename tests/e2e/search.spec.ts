import { expect, test } from '@playwright/test';

test.describe('search', () => {
  test('modal opens from the header and returns results', async ({ page }) => {
    await page.goto('/docs');
    await page.getByRole('button', { name: 'Search the site' }).first().click();
    const dialog = page.locator('pagefind-modal dialog');
    await expect(dialog).toBeVisible();

    await page.keyboard.type('deploy');
    await expect(page.locator('pagefind-modal pagefind-results a').first()).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('search page supports ?q=', async ({ page }) => {
    await page.goto('/search?q=astro');
    await expect(page.locator('pagefind-results a').first()).toBeVisible();
  });
});
