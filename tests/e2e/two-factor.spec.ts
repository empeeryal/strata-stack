import { createHmac } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

import { E2E_PASSWORD, signIn, signUp, waitForIslands } from './helpers';

// Auth requests share one rate-limit bucket (same client IP); run them one at a time.
test.describe.configure({ mode: 'serial' });

/** RFC 4648 base32, as authenticator apps read it from the otpauth:// URI. */
function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of input.replace(/=+$/, '').toUpperCase()) {
    const index = alphabet.indexOf(char);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** The six-digit code an authenticator app would show now (RFC 6238, SHA-1, 30 seconds). */
function totp(secret: string, at = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const digest = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0xf;
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, '0');
}

/** The dashboard's two-factor card, scrolled into view and hydrated. */
async function twoFactorCard(page: Page) {
  const card = page.getByRole('heading', { name: 'Two-factor authentication' }).locator('..');
  await card.scrollIntoViewIfNeeded();
  await waitForIslands(page);
  return card;
}

test.describe('two-factor authentication', () => {
  const email = `totp-${Date.now()}@example.com`;
  let secret = '';
  let backupCode = '';

  test('turns on from the dashboard with a real authenticator code', async ({ page }) => {
    await signUp(page, 'TOTP Tester', email);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('[data-two-factor-state]')).toHaveText('Off');

    const card = await twoFactorCard(page);
    await card.getByRole('button', { name: 'Turn on two-factor authentication' }).click();
    await card.getByLabel('Current password').fill(E2E_PASSWORD);
    await card.getByRole('button', { name: 'Continue' }).click();

    await expect(
      card.getByRole('img', { name: 'QR code for your authenticator app' }),
    ).toBeVisible();
    secret = (await card.locator('[data-totp-secret]').textContent())?.trim() ?? '';
    expect(secret).toMatch(/^[A-Z2-7]+=*$/);

    // A wrong code is explained; the right one shows the backup codes.
    await card.getByLabel('Code from the app').fill('000000');
    await card.getByRole('button', { name: 'Confirm' }).click();
    await expect(card.getByRole('alert')).toContainText('did not match');
    await card.getByLabel('Code from the app').fill(totp(secret));
    await card.getByRole('button', { name: 'Confirm' }).click();

    const codes = card.locator('[data-backup-codes] li');
    await expect(codes).toHaveCount(10);
    backupCode = (await codes.first().textContent())?.trim() ?? '';
    expect(backupCode.length).toBeGreaterThan(0);
    await card.getByRole('button', { name: 'Done' }).click();
    await expect(page).toHaveURL(/\/dashboard\?notice=two-factor-enabled$/);
    await expect(page.locator('[data-account-notice]')).toContainText(
      /two-factor authentication is on/i,
    );
    await expect(page.locator('[data-two-factor-state]')).toHaveText('On');
  });

  test('asks for the code at sign-in and accepts the authenticator', async ({ page }) => {
    await signIn(page, email);
    await expect(page).toHaveURL(/\/two-factor$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('One more step');

    // The pending sign-in gives no access yet.
    const dashboard = await page.request.get('/dashboard', { maxRedirects: 0 });
    expect(dashboard.status()).toBe(302);

    await page.getByLabel('Authenticator code').fill('000000');
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page.getByRole('alert')).toContainText('did not match');
    await page.getByLabel('Authenticator code').fill(totp(secret));
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hello, TOTP Tester');
  });

  test('accepts a backup code once', async ({ page }) => {
    await signIn(page, email);
    await expect(page).toHaveURL(/\/two-factor$/);
    await page.getByRole('button', { name: 'Use a backup code instead' }).click();
    await page.getByLabel('Backup code').fill(backupCode);
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // Signed out, the same backup code is spent.
    await page.getByRole('button', { name: 'Sign out' }).first().click();
    await expect(page).toHaveURL(/\/$/);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/two-factor$/);
    await page.getByRole('button', { name: 'Use a backup code instead' }).click();
    await page.getByLabel('Backup code').fill(backupCode);
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page.getByRole('alert')).toContainText('already used');
  });

  test('turns off with the password and signs in without a second step', async ({ page }) => {
    await signIn(page, email);
    await page.getByLabel('Authenticator code').fill(totp(secret));
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    const card = await twoFactorCard(page);
    await card.getByRole('button', { name: 'Turn off' }).click();
    await card.getByLabel('Current password').fill(E2E_PASSWORD);
    await card.getByRole('button', { name: 'Turn off' }).click();
    await expect(page).toHaveURL(/\/dashboard\?notice=two-factor-disabled$/);
    await expect(page.locator('[data-two-factor-state]')).toHaveText('Off');

    await page.getByRole('button', { name: 'Sign out' }).first().click();
    await expect(page).toHaveURL(/\/$/);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
