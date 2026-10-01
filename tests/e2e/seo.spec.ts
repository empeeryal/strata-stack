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

  test('the sitemap lists every page in its canonical form', async ({ page, request }) => {
    const xml = await (await request.get('/sitemap-0.xml')).text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1] as string);
    expect(locs.length).toBeGreaterThan(10);
    // Canonical URLs have no trailing slash (except the root); the sitemap must say the same.
    for (const loc of locs) expect(loc, loc).toMatch(new RegExp(`^${siteConfig.url}(/|/.+[^/])$`));
    expect(locs).toContain(`${siteConfig.url}/about`);
    expect(locs).not.toContain(`${siteConfig.url}/login`);

    await page.goto('/about');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${siteConfig.url}/about`,
    );
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
    const graphs = await page.locator('script[type="application/ld+json"]').evaluateAll((scripts) =>
      scripts.map(
        (script) =>
          JSON.parse(script.textContent ?? '{}') as {
            '@type': string;
            itemListElement?: Array<{ name: string; item?: string }>;
          },
      ),
    );
    expect(graphs.map((graph) => graph['@type'])).toEqual(
      expect.arrayContaining(['WebSite', 'BreadcrumbList', 'TechArticle']),
    );
    // Search Console flags a BreadcrumbList entry without `item`; every crumb links somewhere,
    // the section crumb to its heading on the docs index.
    const breadcrumbs = graphs.find((graph) => graph['@type'] === 'BreadcrumbList');
    expect(breadcrumbs?.itemListElement?.map((entry) => entry.item)).toEqual([
      `${siteConfig.url}/docs`,
      `${siteConfig.url}/docs#section-getting-started`,
      `${siteConfig.url}/docs/getting-started/introduction`,
    ]);
  });

  test('404 page is served with the right status', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
  });
});
