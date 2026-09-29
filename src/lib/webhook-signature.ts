/**
 * Verification of signed webhook deliveries in the Svix format Resend uses: the headers
 * `svix-id`, `svix-timestamp` and `svix-signature`, an HMAC-SHA256 over
 * `${id}.${timestamp}.${body}` keyed with the base64 secret after the `whsec_` prefix, and a
 * short tolerance on the timestamp. Web Crypto only, so it runs on every deploy target.
 */

/** How far a delivery's timestamp may be from the server clock. */
export const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

export interface SignedRequestHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

export type SignatureVerdict = 'ok' | 'missing' | 'expired' | 'invalid';

function secretBytes(secret: string): Uint8Array<ArrayBuffer> {
  const encoded = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  const decoded = atob(encoded);
  const bytes = new Uint8Array(new ArrayBuffer(decoded.length));
  for (let i = 0; i < decoded.length; i += 1) bytes[i] = decoded.charCodeAt(i);
  return bytes;
}

async function hmac(secret: string, content: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(content));
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

/** Compares two strings in constant time once their lengths match. */
function sameSignature(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Produces the `v1,…` signature for a delivery; used by tests and by the docs example. */
export async function signWebhookPayload(
  secret: string,
  id: string,
  timestamp: string,
  body: string,
): Promise<string> {
  return `v1,${await hmac(secret, `${id}.${timestamp}.${body}`)}`;
}

/**
 * Checks a delivery's signature against the raw request body. The signature header may list
 * several signatures (space separated, each `v1,<base64>`), for example during a secret
 * rotation; any valid one is accepted.
 */
export async function verifyWebhookSignature(
  secret: string,
  headers: SignedRequestHeaders,
  body: string,
  now: number = Date.now(),
): Promise<SignatureVerdict> {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return 'missing';

  const sentAt = Number(timestamp) * 1000;
  if (!Number.isFinite(sentAt) || Math.abs(now - sentAt) > SIGNATURE_TOLERANCE_MS) {
    return 'expired';
  }

  const expected = await hmac(secret, `${id}.${timestamp}.${body}`);
  for (const entry of signature.split(' ')) {
    const [version, value] = entry.split(',', 2);
    if (version === 'v1' && value && sameSignature(value, expected)) return 'ok';
  }
  return 'invalid';
}
