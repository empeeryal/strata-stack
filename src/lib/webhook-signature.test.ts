import { describe, expect, it } from 'vitest';

import { signWebhookPayload, verifyWebhookSignature } from './webhook-signature';

const secret = `whsec_${btoa('a-test-secret-of-reasonable-length')}`;
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

  it('rejects a different secret, a tampered body and a reused id', async () => {
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

  it('reports missing headers', async () => {
    expect(
      await verifyWebhookSignature(secret, { id: null, timestamp, signature: 'v1,x' }, body, now),
    ).toBe('missing');
  });
});
