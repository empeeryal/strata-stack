import { expect, test } from '@playwright/test';

test.describe('blog', () => {
  test('lists posts with tags and opens a post', async ({ page }) => {
    await page.goto('/blog');
    const posts = page.locator('main ul li h2 a');
    await expect(posts).toHaveCount(3);

    await posts.first().click();
    await expect(page).toHaveURL(/\/blog\/[a-z0-9-]+$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('article time').first()).toHaveAttribute(
      'datetime',
      /\d{4}-\d{2}-\d{2}/,
    );
    await expect(page.getByText(/min read/)).toBeVisible();
  });

  test('tabs inside MDX switch panels and sync by key', async ({ page }) => {
    await page.goto('/blog/deploy-anywhere');
    const tabs = page.locator('tab-group').first();
    await tabs.getByRole('tab', { name: 'Netlify' }).click();
    await expect(tabs.getByRole('tab', { name: 'Netlify' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(tabs.getByRole('tabpanel', { includeHidden: false })).toContainText(
      'netlify.toml',
    );
    expect(await page.evaluate(() => localStorage.getItem('tabs:platform'))).toBe('Netlify');
  });

  test('tag pages filter posts', async ({ page }) => {
    await page.goto('/blog/tags/deployment');
    await expect(page.getByRole('heading', { level: 1, name: 'deployment' })).toBeVisible();
    await expect(page.locator('main ul li h2 a')).toHaveCount(1);
  });
});
