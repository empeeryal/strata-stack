import { expect, test } from '@playwright/test';

import { securityHeaders } from '../../config/security-headers';
import { collectCspViolations } from './helpers';

const PAGES = [
  '/',
  '/docs/getting-started/introduction',
  '/blog/deploy-anywhere',
  '/login',
  '/search',
  '/changelog',
  '/contact',
];

test.describe('security', () => {
  test('server-rendered responses include the hardening headers', async ({ request }) => {
    const response = await request.get('/dashboard', { maxRedirects: 0 });
    const headers = response.headers();
    for (const [name, value] of Object.entries(securityHeaders)) {
      expect(headers[name.toLowerCase()], name).toBe(value);
    }
  });

  test('prerendered pages are served with a hash-based Content Security Policy', async ({
    request,
  }) => {
    const response = await request.get('/');
    const csp = response.headers()['content-security-policy'];
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(csp).toMatch(/'sha256-[A-Za-z0-9+/=]+'/);
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  for (const path of PAGES) {
    test(`no CSP violations on ${path}`, async ({ page }) => {
      const violations = collectCspViolations(page);
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      if (path === '/search') {
        await page.locator('search pagefind-input input').fill('astro');
        await page.waitForTimeout(500);
      }
      expect(violations).toEqual([]);
    });
  }
});
