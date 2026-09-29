import { expect, test } from '@playwright/test';

// The site ships in English only. The i18n plumbing stays configured for one locale, so these
// checks pin down what a single-locale build must and must not emit.
test.describe('single locale', () => {
  test('pages declare English and carry no language alternates', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(0);
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'en_US');
    await expect(page.locator('meta[property="og:locale:alternate"]')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Language' })).toHaveCount(0);
  });

  test('the feed is English and there is no prefixed tree', async ({ request }) => {
    const feed = await request.get('/rss.xml');
    expect(feed.status()).toBe(200);
    expect(await feed.text()).toContain('<language>en</language>');
    expect((await request.get('/de')).status()).toBe(404);
    expect((await request.get('/de/blog')).status()).toBe(404);
  });
});
