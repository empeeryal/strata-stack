import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

import { serverEnv } from '../../playwright.config';
import { E2E_PASSWORD, fillContactForm, signIn, waitForIslands } from './helpers';

const [ADMIN_EMAIL] = serverEnv.ADMIN_EMAILS.split(',') as [string, string];

/** Runs axe with the WCAG 2.1 AA rule set against the current page and fails on any violation. */
async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => node.target.join(' ')),
    })),
  ).toEqual([]);
}

const PUBLIC_PAGES: Array<{ path: string; ready?: (page: Page) => Promise<void> }> = [
  { path: '/' },
  { path: '/about' },
  { path: '/docs' },
  { path: '/docs/getting-started/installation' },
  { path: '/blog' },
  { path: '/blog/deploy-anywhere' },
  { path: '/blog/tags' },
  { path: '/changelog' },
  { path: '/legal/privacy' },
  { path: '/contact' },
  { path: '/login' },
  { path: '/signup' },
  { path: '/forgot-password' },
  { path: '/reset-password' },
  { path: '/this-page-does-not-exist' },
  {
    path: '/search?q=astro',
    ready: async (page) => {
      await expect(page.locator('pagefind-results a').first()).toBeVisible();
    },
  },
];

for (const { path, ready } of PUBLIC_PAGES) {
  test(`no accessibility violations on ${path}`, { tag: '@a11y' }, async ({ page }) => {
    await page.goto(path);
    await ready?.(page);
    await expectNoViolations(page);
  });
}

test.describe('interactive states', { tag: '@a11y' }, () => {
  test('the open mobile navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('dialog', { name: 'Site navigation' })).toBeVisible();
    await expectNoViolations(page);
  });

  test('the open search dialog with results', async ({ page }) => {
    await page.goto('/docs');
    await page.getByRole('button', { name: 'Search the site' }).first().click();
    await expect(page.locator('pagefind-modal dialog')).toBeVisible();
    await page.keyboard.type('deploy');
    await expect(page.locator('pagefind-modal pagefind-results a').first()).toBeVisible();
    await expectNoViolations(page);
  });

  test('the contact form showing validation errors', async ({ page }) => {
    await fillContactForm(page, { name: 'Axe Tester', message: 'too short' });
    // Bypass native validation so the server-side errors are rendered.
    await page.evaluate(() => document.querySelector('form')?.setAttribute('novalidate', ''));
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('alert')).toContainText('highlighted fields');
    await expectNoViolations(page);
  });

  test('the sign-in form after a failed attempt', async ({ page }) => {
    await signIn(page, 'nobody@example.com', 'not-the-password');
    await expect(page.getByRole('alert')).toContainText(/invalid email or password/i);
    await expectNoViolations(page);
  });
});

test.describe('signed-in pages', { tag: '@a11y' }, () => {
  // One sign-in for the whole block: auth requests share a rate limit, and every test below
  // only reads pages. Each test opens a context carrying the administrator's cookies.
  test.describe.configure({ mode: 'serial' });
  let storageState: Awaited<ReturnType<BrowserContext['storageState']>>;
  // The block opens only this message: opening one marks it read, and the admin spec running in
  // another worker asserts that its own message stays new.
  const sender = `Axe Sender ${Date.now()}`;

  async function asAdmin(browser: Browser, run: (page: Page) => Promise<void>) {
    const context = await browser.newContext({ storageState });
    try {
      await run(await context.newPage());
    } finally {
      await context.close();
    }
  }

  test.beforeAll(async ({ browser, request }) => {
    const response = await request.post('/api/auth/sign-up/email', {
      data: { name: 'E2E Admin', email: ADMIN_EMAIL, password: E2E_PASSWORD },
    });
    expect([200, 422]).toContain(response.status()); // 422: created by another spec already

    const context = await browser.newContext();
    const page = await context.newPage();
    await signIn(page, ADMIN_EMAIL);
    await expect(page).toHaveURL(/\/dashboard$/);
    // Give the inbox a message so the detail page has something to render.
    await fillContactForm(page, {
      name: sender,
      message: 'A message long enough to be accepted by the contact form.',
    });
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'your message' })).toBeVisible();
    storageState = await context.storageState();
    await context.close();
  });

  for (const path of ['/dashboard', '/admin', '/admin/messages', '/admin/users', '/admin/audit']) {
    test(`no accessibility violations on ${path}`, async ({ browser }) => {
      await asAdmin(browser, async (page) => {
        await page.goto(path);
        await expectNoViolations(page);
      });
    });
  }

  test('the filtered audit log', async ({ browser }) => {
    await asAdmin(browser, async (page) => {
      await page.goto('/admin/audit?action=message.status&q=example.com');
      await expect(page.locator('[data-list-summary]')).toBeVisible();
      await expectNoViolations(page);
    });
  });

  test('a message detail page', async ({ browser }) => {
    await asAdmin(browser, async (page) => {
      await page.goto(`/admin/messages?q=${encodeURIComponent(sender)}`);
      await page.getByRole('link', { name: sender }).click();
      await expect(page).toHaveURL(/\/admin\/messages\/[^/]+$/);
      await expectNoViolations(page);
    });
  });

  test('the inbox at phone width', async ({ browser }) => {
    await asAdmin(browser, async (page) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/admin/messages');
      await expectNoViolations(page);
    });
  });

  test('the dashboard with the account-deletion form open', async ({ browser }) => {
    await asAdmin(browser, async (page) => {
      await page.goto('/dashboard');
      await page.getByRole('button', { name: 'Delete my account' }).scrollIntoViewIfNeeded();
      await waitForIslands(page);
      await page.getByRole('button', { name: 'Delete my account' }).click();
      await expect(page.getByRole('form', { name: 'Delete account' })).toBeVisible();
      await expectNoViolations(page);
    });
  });
});
