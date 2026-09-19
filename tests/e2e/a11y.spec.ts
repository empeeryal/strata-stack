import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = [
  '/',
  '/docs',
  '/docs/getting-started/installation',
  '/blog',
  '/blog/deploy-anywhere',
  '/login',
  '/contact',
  '/changelog',
];

for (const path of PAGES) {
  test(`no accessibility violations on ${path}`, { tag: '@a11y' }, async ({ page }) => {
    await page.goto(path);
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
  });
}
