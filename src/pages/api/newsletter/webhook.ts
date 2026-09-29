import type { APIRoute } from 'astro';

import { getEnv } from '@/lib/env';
import { applyProviderContactEvent } from '@/lib/newsletter';
import { newsletterDeps } from '@/lib/newsletter-deps';
import { verifyWebhookSignature } from '@/lib/webhook-signature';

export const prerender = false;

/**
 * Receives Resend's contact webhooks so an address that unsubscribes through a broadcast's
 * own link (or is deleted at Resend) is marked unsubscribed here too. Every delivery must
 * carry a valid signature for `RESEND_WEBHOOK_SECRET`; without the secret the endpoint does
 * not exist. Deliveries are acknowledged even when nothing changes, so Resend does not retry.
 */
export const POST: APIRoute = async ({ request }) => {
  const secret = getEnv('RESEND_WEBHOOK_SECRET');
  if (!secret) return new Response(null, { status: 404 });

  const body = await request.text();
  const verdict = await verifyWebhookSignature(
    secret,
    {
      id: request.headers.get('svix-id'),
      timestamp: request.headers.get('svix-timestamp'),
      signature: request.headers.get('svix-signature'),
    },
    body,
  );
  if (verdict !== 'ok') {
    return Response.json({ error: `Signature ${verdict}.` }, { status: 401 });
  }

  let event: unknown;
  try {
    event = JSON.parse(body);
  } catch {
    return Response.json({ error: 'The body is not JSON.' }, { status: 400 });
  }

  const outcome = await applyProviderContactEvent(event, newsletterDeps());
  return Response.json({ received: true, outcome });
};
