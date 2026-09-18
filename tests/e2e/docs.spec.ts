import { expect, test } from '@playwright/test';

test.describe('documentation', () => {
  test('index lists sections and pages', async ({ page }) => {
    await page.goto('/docs');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Everything you need');
    await expect(page.getByRole('heading', { name: 'Getting started' })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Installation/ })).toBeVisible();
  });

  test('page shows sidebar, table of contents and prev/next links', async ({ page, isMobile }) => {
    await page.goto('/docs/getting-started/installation');
    await expect(page.getByRole('heading', { level: 1, name: 'Installation' })).toBeVisible();

    const nav = page.getByRole('navigation', { name: 'Documentation' }).first();
    if (isMobile) {
      await page.getByText('Documentation menu').click();
    }
    await expect(nav.getByRole('link', { name: 'Installation' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await expect(page.getByRole('link', { name: 'Prerequisites' }).first()).toHaveAttribute(
      'href',
      '#prerequisites',
    );
    await expect(page.getByRole('link', { name: /Previous/ })).toHaveAttribute(
      'href',
      '/docs/getting-started/introduction',
    );
    await expect(page.getByRole('link', { name: /Next/ })).toHaveAttribute(
      'href',
      '/docs/getting-started/project-structure',
    );
  });

  test('headings receive anchor links', async ({ page }) => {
    await page.goto('/docs/getting-started/installation');
    const anchor = page.locator('h2#prerequisites a.heading-anchor');
    await expect(anchor).toHaveAttribute('href', '#prerequisites');
  });
});
