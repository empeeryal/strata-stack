import { expect, test } from '@playwright/test';

import { waitForPalette } from './helpers';

test.describe('command palette', () => {
  test('opens from the header, lists docs and returns search results', async ({ page }) => {
    await page.goto('/docs');
    await waitForPalette(page);
    await page.getByRole('link', { name: 'Search the site' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Command palette' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('option', { name: 'Installation' })).toBeVisible();

    await page.keyboard.type('deploy');
    const results = dialog.getByRole('group', { name: 'Search results' });
    await expect(results.getByRole('option').first()).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('opens with the shortcut and navigates with Enter', async ({ page }) => {
    await page.goto('/');
    await waitForPalette(page);
    await page.keyboard.press('ControlOrMeta+k');
    const dialog = page.getByRole('dialog', { name: 'Command palette' });
    await expect(dialog).toBeVisible();
    await page.keyboard.type('changelog');
    await expect(dialog.getByRole('option', { name: 'Changelog', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/changelog\/?$/);
  });

  test('the header trigger is a link to the search page without JavaScript', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/');
    await page.getByRole('link', { name: 'Search the site' }).first().click();
    await expect(page).toHaveURL(/\/search\/?$/);
    await context.close();
  });

  test('search page supports ?q=', async ({ page }) => {
    await page.goto('/search?q=astro');
    await expect(page.locator('pagefind-results a').first()).toBeVisible();
  });
});
