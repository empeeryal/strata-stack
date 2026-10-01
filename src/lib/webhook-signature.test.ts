import { describe, expect, it, vi } from 'vitest';

import { verifyWebhookSignature } from './webhook-signature';

const secret = `whsec_${btoa('a-test-secret-of-reasonable-length')}`;

/** Signs a delivery the way Resend (Svix) does; the module under test only verifies. */
async function signWebhookPayload(
  signingSecret: string,
  id: string,
  ts: string,
  payload: string,
): Promise<string> {
  const raw = Buffer.from(signingSecret.replace(/^whsec_/, ''), 'base64');
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${id}.${ts}.${payload}`),
  );
  return `v1,${Buffer.from(digest).toString('base64')}`;
}
const body = '{"type":"contact.updated","data":{"email":"reader@example.com"}}';
const now = Date.UTC(2026, 8, 29, 12, 0, 0);
const timestamp = String(Math.floor(now / 1000));

async function headers(overrides: Partial<Record<'id' | 'timestamp' | 'signature', string>> = {}) {
  const id = overrides.id ?? 'msg_1';
  const ts = overrides.timestamp ?? timestamp;
  return {
    id,
    timestamp: ts,
    signature: overrides.signature ?? (await signWebhookPayload(secret, id, ts, body)),
  };
}

describe('verifyWebhookSignature', () => {
  it('accepts a signature made with the secret, with or without the prefix', async () => {
    expect(await verifyWebhookSignature(secret, await headers(), body, now)).toBe('ok');
    const bare = secret.slice('whsec_'.length);
    expect(await verifyWebhookSignature(bare, await headers(), body, now)).toBe('ok');
  });

  it('accepts a list of signatures when one of them is valid', async () => {
    const good = await signWebhookPayload(secret, 'msg_1', timestamp, body);
    const signature = `v1,${btoa('not-this-one')} ${good}`;
    expect(await verifyWebhookSignature(secret, await headers({ signature }), body, now)).toBe(
      'ok',
    );
  });

  it('rejects a different secret, a tampered body and a signature for another delivery id', async () => {
    const other = `whsec_${btoa('a-different-secret-of-similar-length')}`;
    expect(await verifyWebhookSignature(other, await headers(), body, now)).toBe('invalid');
    expect(await verifyWebhookSignature(secret, await headers(), `${body} `, now)).toBe('invalid');
    const forOtherId = await signWebhookPayload(secret, 'msg_2', timestamp, body);
    expect(
      await verifyWebhookSignature(secret, await headers({ signature: forOtherId }), body, now),
    ).toBe('invalid');
  });

  it('rejects deliveries outside the time window', async () => {
    const old = String(Math.floor((now - 6 * 60 * 1000) / 1000));
    expect(await verifyWebhookSignature(secret, await headers({ timestamp: old }), body, now)).toBe(
      'expired',
    );
    expect(
      await verifyWebhookSignature(secret, await headers({ timestamp: 'soon' }), body, now),
    ).toBe('expired');
  });

  it('refuses deliveries instead of failing when the secret is not base64', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await verifyWebhookSignature('whsec_not*base64!', await headers(), body, now)).toBe(
      'invalid',
    );
    expect(error).toHaveBeenCalledOnce();
  });

  it('reports missing headers', async () => {
    expect(
      await verifyWebhookSignature(secret, { id: null, timestamp, signature: 'v1,x' }, body, now),
    ).toBe('missing');
  });
});
