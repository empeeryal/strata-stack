import { expect, test } from '@playwright/test';

import { siteConfig } from '../../src/site.config';

test.describe('SEO and discovery endpoints', () => {
  test('robots.txt, sitemap, RSS, manifest, llms.txt and OG images are served', async ({
    request,
  }) => {
    const robots = await request.get('/robots.txt');
    expect(robots.ok()).toBeTruthy();
    expect(await robots.text()).toContain('Sitemap:');

    const sitemap = await request.get('/sitemap-index.xml');
    expect(sitemap.ok()).toBeTruthy();
    expect(await sitemap.text()).toContain('<sitemapindex');

    const rss = await request.get('/rss.xml');
    expect(rss.ok()).toBeTruthy();
    expect(await rss.text()).toContain('<rss');

    const manifest = await request.get('/manifest.webmanifest');
    expect(manifest.ok()).toBeTruthy();
    expect((await manifest.json()).name).toBe(siteConfig.name);

    const llms = await request.get('/llms.txt');
    expect(await llms.text()).toContain(`# ${siteConfig.name}`);

    const og = await request.get('/og/default.png');
    expect(og.ok()).toBeTruthy();
    expect(og.headers()['content-type']).toContain('image/png');

    const securityTxt = await request.get('/.well-known/security.txt');
    expect(await securityTxt.text()).toContain('Contact:');
  });

  test('pages carry canonical, Open Graph and structured data', async ({ page }) => {
    await page.goto('/docs/getting-started/introduction');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${siteConfig.url}/docs/getting-started/introduction`,
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      `${siteConfig.url}/og/docs/getting-started/introduction.png`,
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
    expect(await page.locator('script[type="application/ld+json"]').count()).toBeGreaterThanOrEqual(
      3,
    );
  });

  test('404 page is served with the right status', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
  });
});
