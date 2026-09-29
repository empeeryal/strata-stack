import { createHmac } from 'node:crypto';

import { createClient } from '@libsql/client';
import { expect, test } from '@playwright/test';

import { serverEnv } from '../../playwright.config';
import { waitForIslands } from './helpers';

// Confirmation links are only in the email, which test mode prints to the server console; the
// token is read from the database instead. That needs the local file the web server uses.
const external = Boolean(process.env.E2E_BASE_URL);

async function tokenFor(email: string): Promise<string> {
  const client = createClient({ url: serverEnv.DATABASE_URL });
  try {
    const result = await client.execute({
      sql: 'SELECT token FROM newsletter_subscriber WHERE email = ?',
      args: [email],
    });
    return String(result.rows[0]?.token ?? '');
  } finally {
    client.close();
  }
}

/** Signs a delivery the way Resend (Svix) does, with the secret the test server knows. */
function signedHeaders(body: string, id = `msg_${Date.now()}`) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const key = Buffer.from(serverEnv.RESEND_WEBHOOK_SECRET.slice('whsec_'.length), 'base64');
  const signature = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
  return {
    'content-type': 'application/json',
    'svix-id': id,
    'svix-timestamp': timestamp,
    'svix-signature': `v1,${signature}`,
  };
}

test.describe('newsletter', () => {
  test('subscribes from the footer and confirms, then unsubscribes, through the emailed links', async ({
    page,
  }) => {
    const email = `reader-${Date.now()}@example.com`;
    await page.goto('/changelog');
    await waitForIslands(page);
    const form = page.getByRole('form', { name: 'Subscribe to the newsletter' }).first();
    await form.scrollIntoViewIfNeeded();
    await form.getByLabel('Email address').fill(email);
    await form.getByRole('button', { name: 'Subscribe' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Check your inbox' })).toBeVisible();

    test.skip(external, 'reading the token needs the local database');
    const token = await tokenFor(email);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const heading = page.getByRole('heading', { level: 1 });
    await page.goto(`/newsletter/confirm?token=${token}`);
    await expect(heading).toHaveText('You are subscribed');
    await page.reload();
    await expect(heading).toHaveText('You were already subscribed');

    // Opening the unsubscribe link changes nothing; the button does.
    await page.goto(`/newsletter/unsubscribe?token=${token}`);
    await expect(heading).toContainText('Unsubscribe from');
    await expect(page.getByText(email)).toBeVisible();
    await page.reload();
    await expect(heading).toContainText('Unsubscribe from');
    await page.getByRole('button', { name: 'Unsubscribe' }).click();
    await expect(page).toHaveURL(/\/newsletter\/unsubscribe\?token=/);
    await expect(heading).toHaveText('You are unsubscribed');
    await expect(page.getByText(email)).toBeVisible();

    // An ended subscription cannot be revived by the old confirmation link.
    const response = await page.goto(`/newsletter/confirm?token=${token}`);
    expect(response?.status()).toBe(404);
    await expect(heading).toHaveText('This link is not valid');
  });

  test('answers unknown links with a 404 page and a way back', async ({ page }) => {
    const response = await page.goto('/newsletter/confirm?token=not-a-real-token');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('This link is not valid');
    await expect(page.getByRole('link', { name: 'Subscribe again' })).toHaveAttribute(
      'href',
      '/newsletter',
    );

    const unsubscribe = await page.goto('/newsletter/unsubscribe?token=not-a-real-token');
    expect(unsubscribe?.status()).toBe(404);
    await expect(page.getByRole('button', { name: 'Unsubscribe' })).toHaveCount(0);
  });

  test('works without JavaScript through the newsletter page', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/newsletter');
    // The footer carries a second form; the page's own form is inside main.
    const main = page.locator('#main');
    await main.getByLabel('Email address').fill(`nojs-${Date.now()}@example.com`);
    await main.getByRole('button', { name: 'Subscribe' }).click();
    await expect(page).toHaveURL(/\/newsletter\?sent=1$/);
    await expect(page.locator('[data-newsletter-result]')).toContainText('Check your inbox');
    await context.close();
  });

  test('ends a subscription from a signed provider webhook and refuses unsigned ones', async ({
    page,
    request,
  }) => {
    test.skip(external, 'reading the token needs the local database');
    const email = `webhook-${Date.now()}@example.com`;
    await page.goto('/newsletter');
    await waitForIslands(page);
    const main = page.locator('#main');
    await main.getByLabel('Email address').fill(email);
    await main.getByRole('button', { name: 'Subscribe' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Check your inbox' })).toBeVisible();
    const token = await tokenFor(email);
    await page.goto(`/newsletter/confirm?token=${token}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('You are subscribed');

    const body = JSON.stringify({
      type: 'contact.updated',
      created_at: new Date().toISOString(),
      data: { id: 'c_e2e', email, unsubscribed: true },
    });
    const unsigned = await request.post('/api/newsletter/webhook', {
      data: body,
      headers: { 'content-type': 'application/json' },
    });
    expect(unsigned.status()).toBe(401);
    const tampered = await request.post('/api/newsletter/webhook', {
      data: `${body} `,
      headers: signedHeaders(body),
    });
    expect(tampered.status()).toBe(401);

    const signed = await request.post('/api/newsletter/webhook', {
      data: body,
      headers: signedHeaders(body),
    });
    expect(signed.status()).toBe(200);
    expect(await signed.json()).toEqual({ received: true, outcome: 'unsubscribed' });

    await page.goto(`/newsletter/unsubscribe?token=${token}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('You are unsubscribed');
  });

  test('renders validation errors from a plain form post', async ({ request, baseURL }) => {
    const response = await request.post('/newsletter?_action=newsletter.subscribe', {
      form: { email: 'not-an-address', source: 'page' },
      headers: { origin: baseURL ?? '' },
    });
    // Astro renders the page with the action's status; the error shows above the form.
    expect(response.status()).toBe(400);
    expect(await response.text()).toContain('Please enter a valid email address.');
  });
});
