import { expect, test } from '@playwright/test';

import { siteConfig } from '../../src/site.config';
import { collectConsoleErrors, waitForIslands } from './helpers';

test.describe('home page', () => {
  test('renders the hero and primary navigation without console errors', async ({
    page,
    isMobile,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/');

    await expect(page).toHaveTitle(new RegExp(siteConfig.name));
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Ship a complete website');
    await expect(page.getByRole('link', { name: 'Get started' })).toHaveAttribute(
      'href',
      '/docs/getting-started/introduction',
    );

    if (isMobile) {
      await page.getByRole('button', { name: 'Open menu' }).click();
      const dialog = page.getByRole('dialog', { name: 'Site navigation' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('link', { name: 'Docs' })).toBeVisible();
      await page.getByRole('button', { name: 'Close menu' }).click();
      await expect(dialog).toBeHidden();
    } else {
      await expect(
        page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Docs' }),
      ).toBeVisible();
    }

    expect(errors).toEqual([]);
  });

  test('copies the quick start commands from the code block', async ({ page }) => {
    // Headless browsers have no reliable clipboard; capture what the button writes instead.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: (text: string) => {
            (window as unknown as { copied: string }).copied = text;
            return Promise.resolve();
          },
        },
      });
    });
    await page.goto('/');
    const block = page.locator('figure.code-block').first();
    await block.scrollIntoViewIfNeeded();
    // Located by attribute: the label changes to "Copied", which a role query by name loses.
    const button = block.locator('[data-copy-code]');
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Copy');
    await button.click();
    await expect(button).toHaveText('Copied');
    expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toContain(
      'pnpm install',
    );
  });

  test('deploy target island switches panels', async ({ page }) => {
    await page.goto('/');
    const tablist = page.getByRole('tablist', { name: 'Deploy targets' });
    await tablist.scrollIntoViewIfNeeded();
    // The island uses client:visible, so wait for hydration before interacting.
    await waitForIslands(page);
    await tablist.getByRole('tab', { name: 'Cloudflare' }).click();
    await expect(page.getByRole('tabpanel')).toContainText('workerd');
    await expect(tablist.getByRole('tab', { name: 'Cloudflare' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('dark mode toggle persists across reloads', async ({ page, isMobile }) => {
    test.skip(isMobile, 'toggle lives in the desktop header');
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'light');

    await page.getByRole('button', { name: 'Switch to dark theme' }).first().click();
    await expect(html).toHaveAttribute('data-theme', 'dark');

    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');
  });
});
