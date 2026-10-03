import { type CDPSession, expect, test, type Page } from '@playwright/test';

import { signIn, signUp, waitForIslands } from './helpers';

// Auth requests share one rate-limit bucket (same client IP); run them one at a time.
test.describe.configure({ mode: 'serial' });

/** The keys a virtual authenticator holds, as the protocol exports and imports them. */
async function getCredentials(client: CDPSession, authenticatorId: string) {
  return (await client.send('WebAuthn.getCredentials', { authenticatorId })).credentials;
}
type VirtualCredential = Awaited<ReturnType<typeof getCredentials>>[number];

/**
 * A software authenticator attached through the Chrome DevTools Protocol: it answers every
 * WebAuthn prompt at once (no fingerprint to present). Each page gets its own, so a credential
 * created in one test is exported and loaded into the next test's authenticator.
 */
async function attachAuthenticator(page: Page, credentials: VirtualCredential[] = []) {
  const client = await page.context().newCDPSession(page);
  await client.send('WebAuthn.enable');
  const { authenticatorId } = await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  for (const credential of credentials) {
    await client.send('WebAuthn.addCredential', { authenticatorId, credential });
  }
  return { exportCredentials: () => getCredentials(client, authenticatorId) };
}

/**
 * Turns the autofill offer off for a page. With a virtual authenticator Chrome completes a
 * conditional request on its own (there is no dropdown to pick from), which would sign in before
 * the test reaches the button it wants to exercise.
 */
async function withoutAutofill(page: Page) {
  await page.addInitScript(() => {
    PublicKeyCredential.isConditionalMediationAvailable = async () => false;
  });
}

/** The dashboard's passkeys card, scrolled into view and hydrated. */
async function passkeysCard(page: Page) {
  const card = page.getByRole('heading', { name: 'Passkeys' }).locator('..');
  await card.scrollIntoViewIfNeeded();
  await waitForIslands(page);
  return card;
}

test.describe('passkeys', () => {
  const email = `passkey-${Date.now()}@example.com`;
  let credentials: VirtualCredential[] = [];

  test('adds a passkey from the dashboard and names it', async ({ page }) => {
    const authenticator = await attachAuthenticator(page);
    await signUp(page, 'Passkey Tester', email);
    await expect(page).toHaveURL(/\/dashboard$/);

    let card = await passkeysCard(page);
    await expect(card.locator('[data-passkeys-empty]')).toBeVisible();
    await card.getByRole('button', { name: 'Add a passkey' }).click();
    await card.getByLabel('Name (optional)').fill('Test authenticator');
    await card.getByRole('button', { name: 'Create passkey' }).click();

    await expect(page).toHaveURL(/\/dashboard\?notice=passkey-added$/);
    await expect(page.locator('[data-account-notice]')).toContainText('Passkey added');
    card = await passkeysCard(page);
    await expect(card.locator('[data-passkeys] > li')).toHaveCount(1);
    await expect(card.locator('[data-passkeys]')).toContainText('Test authenticator');
    // The account card lists the new method.
    await expect(page.getByText('Password, Passkey')).toBeVisible();

    // Rename in place.
    await card.getByRole('button', { name: 'Rename Test authenticator' }).click();
    await card.getByLabel('New name').fill('Work laptop');
    await card.getByRole('button', { name: 'Save' }).click();
    await expect(card.locator('[data-passkeys-status]')).toHaveText('Passkey renamed.');
    await expect(card.locator('[data-passkeys]')).toContainText('Work laptop');

    credentials = await authenticator.exportCredentials();
    expect(credentials).toHaveLength(1);
  });

  test('offers the saved passkey in the sign-in form', async ({ page }) => {
    // Conditional mediation: the login page asks for saved passkeys without a click, and the
    // virtual authenticator answers at once, so the page signs in by itself.
    const authenticator = await attachAuthenticator(page, credentials);
    await page.goto('/login');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hello, Passkey Tester');
    // Every sign-in advances the key's signature counter, and the server refuses a counter that
    // went backwards (a cloned authenticator); carry the current value into the next test.
    credentials = await authenticator.exportCredentials();
  });

  test('signs in with the button alone: no password, no second step', async ({ page }) => {
    await withoutAutofill(page);
    const authenticator = await attachAuthenticator(page, credentials);
    await page.goto('/login');
    await waitForIslands(page);
    await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hello, Passkey Tester');
    credentials = await authenticator.exportCredentials();
  });

  test('refuses an authenticator without a passkey for the site', async ({ page }) => {
    await withoutAutofill(page);
    await attachAuthenticator(page);
    await page.goto('/login');
    await waitForIslands(page);
    await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
    await expect(page.getByRole('alert')).toContainText(/No passkey was used/);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('a removed passkey no longer signs in', async ({ page }) => {
    await withoutAutofill(page);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/dashboard$/);
    const card = await passkeysCard(page);
    await card.getByRole('button', { name: 'Remove Work laptop' }).click();
    await expect(card.getByRole('group', { name: 'Remove Work laptop' })).toContainText(
      'no longer sign in with it',
    );
    await card.getByRole('button', { name: 'Remove passkey' }).click();
    await expect(page).toHaveURL(/\/dashboard\?notice=passkey-removed$/);
    await expect(page.locator('[data-account-notice]')).toContainText('Passkey removed');
    await expect(page.getByText('Password, Passkey')).toHaveCount(0);
    await expect(page.locator('[data-passkeys-empty]')).toBeVisible();

    // The device still holds the key; the server no longer knows it.
    await attachAuthenticator(page, credentials);
    await page.getByRole('button', { name: 'Sign out' }).first().click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/login');
    await waitForIslands(page);
    await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
    await expect(page.getByRole('alert')).toContainText(/not registered here any more/);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('the server refuses passkey endpoints without a session or a challenge', async ({
    request,
  }) => {
    const origin = new URL(test.info().project.use.baseURL ?? 'http://localhost:4321').origin;
    expect((await request.get('/api/auth/passkey/generate-register-options')).status()).toBe(401);
    expect((await request.get('/api/auth/passkey/list-user-passkeys')).status()).toBe(401);
    const assertion = {
      data: { response: { id: 'nope', rawId: 'nope', type: 'public-key', response: {} } },
      headers: { origin },
    };
    // An assertion without a challenge to answer is a bad request.
    const noChallenge = await request.post('/api/auth/passkey/verify-authentication', assertion);
    expect(noChallenge.status()).toBe(400);
    // Authentication options are public (the browser needs them to sign in) and set the challenge
    // cookie; an assertion for a credential the server does not know is then refused.
    expect((await request.get('/api/auth/passkey/generate-authenticate-options')).status()).toBe(
      200,
    );
    const unknown = await request.post('/api/auth/passkey/verify-authentication', assertion);
    expect(unknown.status()).toBe(401);
  });
});
