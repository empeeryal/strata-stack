import { createHmac } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { serverEnv } from '../../playwright.config';

import { E2E_PASSWORD, signIn, signUp, waitForIslands } from './helpers';

/**
 * The link Better Auth emails to the new address, built the way it builds it: a JWT signed with
 * the auth secret whose payload names both addresses and the step. The e2e server has no email
 * provider, so this is how the suite gets hold of one.
 */
function changeEmailLink(email: string, updateTo: string): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    email,
    updateTo,
    requestType: 'change-email-verification',
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createHmac('sha256', serverEnv.BETTER_AUTH_SECRET)
    .update(body)
    .digest('base64url');
  return `/api/auth/verify-email?token=${body}.${signature}&callbackURL=${encodeURIComponent(
    '/dashboard?notice=email-change',
  )}`;
}

// Auth requests share one rate-limit bucket (same client IP); run them one at a time.
test.describe.configure({ mode: 'serial' });

test.describe('changing the email address', () => {
  const stamp = Date.now();
  const email = `address-${stamp}@example.com`;
  const newEmail = `address-${stamp}-new@example.com`;

  test('needs the password and takes effect right away without email delivery', async ({
    page,
  }) => {
    // The e2e server has no email provider and verifies nobody, so the change applies at once.
    await signUp(page, 'Address Tester', email);
    await expect(page).toHaveURL(/\/dashboard$/);

    const form = page.getByRole('form', { name: 'Change email address' });
    await form.scrollIntoViewIfNeeded();
    await waitForIslands(page);
    await expect(form).toContainText('takes effect right away');

    // A wrong password is refused by the server, whatever the client sends.
    await form.getByLabel('New email address').fill(newEmail);
    await form.getByLabel('Current password').fill('not-the-password');
    await form.getByRole('button', { name: 'Change email address' }).click();
    await expect(form.getByRole('alert')).toContainText(/invalid password/i);
    await expect(page.getByRole('definition').filter({ hasText: email })).toBeVisible();

    await form.getByLabel('Current password').fill(E2E_PASSWORD);
    await form.getByRole('button', { name: 'Change email address' }).click();
    await expect(page).toHaveURL(/\/dashboard\?notice=email-updated$/);
    await expect(page.locator('[data-account-notice]')).toHaveText('Email address updated.');
    // The account card and the email card both show the address now in use.
    await expect(page.getByRole('definition').filter({ hasText: newEmail })).toBeVisible();
    await expect(page.getByText(email, { exact: true })).toHaveCount(0);
  });

  test('the old address no longer signs in and the new one does', async ({ page, request }) => {
    // Without the password the server refuses before Better Auth sees the request.
    const origin = new URL(test.info().project.use.baseURL ?? 'http://localhost:4321').origin;
    await signIn(page, email);
    await expect(page.getByRole('alert')).toContainText(/invalid email or password/i);

    await signIn(page, newEmail);
    await expect(page).toHaveURL(/\/dashboard$/);
    const cookies = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
    const withoutPassword = await request.post('/api/auth/change-email', {
      data: { newEmail: `again-${stamp}@example.com` },
      headers: { origin, cookie: cookies },
    });
    expect(withoutPassword.status()).toBe(400);
    expect((await withoutPassword.json()).message).toMatch(/enter your password/i);
  });

  test('the link that applies a change only works in a signed-in browser', async ({
    page,
    request,
  }) => {
    const finalEmail = `address-${stamp}-verified@example.com`;
    const link = changeEmailLink(newEmail, finalEmail);

    // Signed out, the link does not sign anyone in: it sends them to the login page and back.
    const anonymous = await request.get(link, { maxRedirects: 0 });
    expect(anonymous.status()).toBe(302);
    const location = new URL(anonymous.headers().location ?? '', 'http://e2e');
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('error')).toBe('sign_in_to_change_email');
    expect(location.searchParams.get('next')).toBe(link);
    expect((await request.get('/dashboard', { maxRedirects: 0 })).status()).toBe(302);
    await page.goto(anonymous.headers().location ?? '/login');
    await expect(page.getByRole('alert')).toContainText('Sign in to finish changing');

    // Signed in as the account the link belongs to, the same link completes the change.
    await signIn(page, newEmail);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(link);
    await expect(page).toHaveURL(/\/dashboard\?notice=email-change$/);
    await expect(page.locator('[data-account-notice]')).toContainText('Link confirmed');
    await expect(page.getByRole('definition').filter({ hasText: finalEmail })).toBeVisible();
    await expect(page.getByText('Verified', { exact: true })).toBeVisible();
  });
});
