import type { Page } from '@playwright/test';

/**
 * Collects console errors and page errors, ignoring network noise that is specific
 * to sandboxed CI environments (blocked third-party hosts).
 */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/net::ERR_|Failed to load resource/.test(text)) return;
    errors.push(text);
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** Console messages that indicate a Content Security Policy violation. */
export function collectCspViolations(page: Page): string[] {
  const violations: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (/Content[- ]Security[- ]Policy|Refused to (load|execute|apply|connect)/i.test(text)) {
      violations.push(text);
    }
  });
  return violations;
}

/** Waits until every Astro island on the page has hydrated (the `ssr` attribute is removed). */
export async function waitForIslands(page: Page): Promise<void> {
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
}
