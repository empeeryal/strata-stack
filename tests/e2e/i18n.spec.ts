import { expect, test } from '@playwright/test';

import { collectConsoleErrors } from './helpers';

// English lives at the root, German under /de. Only translated pages exist in German; the
// switcher links to the translation when there is one and to the German home page otherwise.
test.describe('internationalisation', () => {
  test('the German home page renders in German and links back to English', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/de');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Astro 7');

    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
    await expect(nav.getByRole('link', { name: 'Dokumentation' })).toHaveAttribute('href', '/docs');
    await expect(nav.getByRole('link', { name: 'Blog' })).toHaveAttribute('href', '/de/blog');
    await expect(nav.getByRole('link', { name: 'Über' })).toHaveAttribute('href', '/de/about');

    const switcher = page.getByRole('navigation', { name: 'Sprache' }).first();
    await expect(switcher.getByRole('link', { name: 'English' })).toHaveAttribute('href', '/');

    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
      'href',
      /\/$/,
    );
    await expect(page.locator('link[rel="alternate"][hreflang="de"]')).toHaveAttribute(
      'href',
      /\/de$/,
    );
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
      'href',
      /\/$/,
    );
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'de_DE');
    expect(errors).toEqual([]);
  });

  test('the English home page offers German and stays English itself', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    const switcher = page.getByRole('navigation', { name: 'Language' }).first();
    await expect(switcher.getByRole('link', { name: 'Deutsch' })).toHaveAttribute('href', '/de');
    await expect(
      page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Docs' }),
    ).toHaveAttribute('href', '/docs');
  });

  test('the German blog lists the translated post first and the English ones after', async ({
    page,
  }) => {
    await page.goto('/de/blog');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Blog');
    await expect(
      page.getByRole('link', { name: 'Warum wir für jede neue Website auf Astro 7 setzen' }),
    ).toHaveAttribute('href', '/de/blog/why-astro-7');
    const english = page.getByRole('region', { name: 'Weitere Beiträge auf Englisch' });
    await expect(english).toBeVisible();
    // Each card carries the language of the post it links to.
    await expect(
      english.getByRole('listitem').first().getByText('English', { exact: true }),
    ).toBeVisible();
    await expect(english.getByRole('link').first()).toHaveAttribute('href', /^\/blog\//);
  });

  test('a translated post and its original link to each other', async ({ page }) => {
    await page.goto('/de/blog/why-astro-7');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Astro 7');
    const switcher = page.getByRole('navigation', { name: 'Sprache' }).first();
    await expect(switcher.getByRole('link', { name: 'English' })).toHaveAttribute(
      'href',
      '/blog/why-astro-7',
    );
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
      'href',
      /\/blog\/why-astro-7$/,
    );
    await expect(page.getByText('Min. Lesezeit')).toBeVisible();

    await page.goto('/blog/why-astro-7');
    const back = page.getByRole('navigation', { name: 'Language' }).first();
    await expect(back.getByRole('link', { name: 'Deutsch' })).toHaveAttribute(
      'href',
      '/de/blog/why-astro-7',
    );
    await expect(page.locator('link[rel="alternate"][hreflang="de"]')).toHaveAttribute(
      'href',
      /\/de\/blog\/why-astro-7$/,
    );
  });

  test('pages without a translation send the switcher to the German home page', async ({
    page,
  }) => {
    await page.goto('/docs');
    const switcher = page.getByRole('navigation', { name: 'Language' }).first();
    await expect(switcher.getByRole('link', { name: 'Deutsch' })).toHaveAttribute('href', '/de');
    await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(0);
  });

  test('the German feed only carries German posts', async ({ request }) => {
    const response = await request.get('/de/rss.xml');
    expect(response.status()).toBe(200);
    const xml = await response.text();
    expect(xml).toContain('<language>de</language>');
    expect(xml).toContain('/de/blog/why-astro-7');
    expect(xml).not.toContain('/blog/deploy-anywhere');
  });

  test('German pages are not served under English paths and vice versa', async ({ request }) => {
    expect((await request.get('/de/docs')).status()).toBe(404);
    expect((await request.get('/blog/de/why-astro-7')).status()).toBe(404);
  });
});
