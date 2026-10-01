import { expect, test } from '@playwright/test';

test.describe('back to top', () => {
  test('appears after a screen of scrolling, returns to the top and moves focus', async ({
    page,
  }) => {
    await page.goto('/docs/getting-started/introduction');
    const button = page.getByRole('button', { name: 'Back to top' });
    await expect(button).toBeHidden();

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(button).toBeVisible();

    await button.click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(button).toBeHidden();
    // Focus lands on the main landmark, not on a control that has just disappeared.
    await expect(page.locator('main#main')).toBeFocused();
  });
});
