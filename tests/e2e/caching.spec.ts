import { expect, test } from '@playwright/test';

import { siteConfig } from '../../src/site.config';
import { signUp } from './helpers';

// The Node server keeps cached responses in memory and reports what it did in X-Astro-Cache
// (MISS: rendered and stored, HIT: served from the cache, STALE: served while revalidating).
// The CDN targets do the same at the edge with their own status headers.
test.describe('route caching', () => {
  test('the repository stats endpoint is cached after the first request', async ({ request }) => {
    const first = await request.get('/api/repo-stats');
    expect(first.status()).toBe(200);
    const body = (await first.json()) as { url: string; stars: number | null };
    expect(body.url).toBe(siteConfig.repo.url);
    expect(body.stars === null || typeof body.stars === 'number').toBe(true);
    expect(first.headers()['cache-control']).toBe('public, max-age=300');
    // Other tests may have warmed the entry already.
    expect(['MISS', 'HIT', 'STALE']).toContain(first.headers()['x-astro-cache']);

    const second = await request.get('/api/repo-stats');
    expect(['HIT', 'STALE']).toContain(second.headers()['x-astro-cache']);
    // The CDN directives are consumed by the memory provider and never reach the client.
    expect(second.headers()['cdn-cache-control']).toBeUndefined();
    expect(second.headers()['cache-tag']).toBeUndefined();
  });

  test('responses for signed-in visitors are never stored', async ({ page, request }) => {
    // A unique query string gives this test its own cache entry.
    const path = `/api/repo-stats?probe=${Date.now()}`;
    await signUp(page, 'Cache Tester', `cache-${Date.now()}@example.com`);
    await expect(page).toHaveURL(/\/dashboard/);

    const signedIn = await page.request.get(path);
    expect(signedIn.status()).toBe(200);
    expect(signedIn.headers()['x-astro-cache']).toBeUndefined();

    // The anonymous request that follows finds nothing and renders it.
    const anonymous = await request.get(path);
    expect(anonymous.headers()['x-astro-cache']).toBe('MISS');
  });

  test('the header shows the star count once it is known', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the count is only shown on wider screens');
    await page.goto('/');
    const link = page.getByRole('banner').getByRole('link', { name: /GitHub repository/ });
    await expect(link).toBeVisible();

    const { stars } = (await (await page.request.get('/api/repo-stats')).json()) as {
      stars: number | null;
    };
    const count = link.locator('[data-repo-stars]');
    if (typeof stars === 'number') {
      await expect(count).toBeVisible();
      await expect(count).toHaveText(/^\d+(\.\d)?[KM]?$/);
      await expect(link).toHaveAttribute('aria-label', /GitHub repository, .* stars/);
    } else {
      await expect(count).toBeHidden();
    }
  });
});
