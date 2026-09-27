import { expect, test } from '@playwright/test';

test.describe('pricing table', () => {
  test('switches between monthly and annual prices', async ({ page }) => {
    await page.goto('/docs/components/pricing-table');
    const table = page.locator('pricing-table').first();
    await expect(table.getByRole('radio', { name: 'Monthly' })).toBeVisible();
    await expect(table.getByText('$19')).toBeVisible();
    await expect(table.getByText('$15')).toBeHidden();

    // The radios are visually hidden; the labels are the click targets.
    await table.locator('label', { hasText: 'Annual' }).click();
    await expect(table.getByRole('radio', { name: /Annual/ })).toBeChecked();
    await expect(table.getByText('$15')).toBeVisible();
    await expect(table.getByText('$19')).toBeHidden();
    await expect(table.getByText('billed annually').first()).toBeVisible();
    // A tier with a single price keeps it in both modes.
    await expect(table.getByText('$0')).toBeVisible();
  });

  test('shows monthly prices and no switch without JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/docs/components/pricing-table');
    const table = page.locator('pricing-table').first();
    await expect(table.getByText('$19')).toBeVisible();
    await expect(table.getByRole('radio', { name: 'Monthly' })).toHaveCount(0);
    await context.close();
  });
});
