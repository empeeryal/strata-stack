import type { Page } from '@playwright/test';

/** Password shared by every account the suite creates. */
export const E2E_PASSWORD = 'correct-horse-battery';

/** Collects console errors and page errors so a test can assert there were none. */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
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

/**
 * Waits until every Astro island that can hydrate has hydrated (Astro removes the `ssr`
 * attribute). Islands with `client:visible` only hydrate once they scroll into view, so those
 * outside the viewport are not waited for; scroll to one first when a test needs it.
 */
export async function waitForIslands(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    for (const island of document.querySelectorAll('astro-island[ssr]')) {
      if (island.getAttribute('client') !== 'visible') return false;
      // The island itself is `display: contents`; measure what it renders.
      const rect = island.firstElementChild?.getBoundingClientRect();
      if (rect && rect.bottom > 0 && rect.top < window.innerHeight) return false;
    }
    return true;
  });
}

/**
 * Waits until the command palette has attached its shortcut and trigger listeners. The island
 * hydrates on idle, and React runs that effect after Astro clears the island's `ssr` flag, so
 * the palette marks readiness itself.
 */
export async function waitForPalette(page: Page): Promise<void> {
  await page.locator('dialog[aria-label="Command palette"][data-ready]').waitFor({
    state: 'attached',
  });
}

/** Fills and submits the sign-up form; the caller asserts where the page lands. */
export async function signUp(page: Page, name: string, email: string, password = E2E_PASSWORD) {
  await page.goto('/signup');
  await waitForIslands(page);
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
}

/** Fills and submits the sign-in form; the caller asserts where the page lands. */
export async function signIn(page: Page, email: string, password = E2E_PASSWORD) {
  await page.goto('/login');
  await waitForIslands(page);
  await page.getByLabel('Email').first().fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** Opens and submits the delete-account form on the dashboard; returns the form for assertions. */
export async function submitAccountDeletion(page: Page, password = E2E_PASSWORD) {
  // The form hydrates on visibility, so bring it into view before waiting for islands.
  await page.getByRole('button', { name: 'Delete my account' }).scrollIntoViewIfNeeded();
  await waitForIslands(page);
  await page.getByRole('button', { name: 'Delete my account' }).click();
  // The change-password form has a "Current password" field too; scope to the delete form.
  const form = page.getByRole('form', { name: 'Delete account' });
  await form.getByLabel('Current password').fill(password);
  await form.getByLabel('Type DELETE to confirm').fill('DELETE');
  await form.getByRole('button', { name: 'Permanently delete account' }).click();
  return form;
}

/** Fills the contact form without submitting it. */
export async function fillContactForm(
  page: Page,
  { name, message, honeypot = false }: { name: string; message: string; honeypot?: boolean },
) {
  await page.goto('/contact');
  await waitForIslands(page);
  await page.getByLabel('Name').fill(name);
  // Exact: the footer's newsletter field is labelled "Email address".
  await page.getByLabel('Email', { exact: true }).fill(`contact-${Date.now()}@example.com`);
  await page.getByLabel('Message').fill(message);
  if (honeypot) {
    // The field is off-screen for people; bots fill it programmatically.
    await page.evaluate(() => {
      const field = document.querySelector<HTMLInputElement>('input[name="website"]');
      if (field) field.value = 'https://spam.example';
    });
  }
}
