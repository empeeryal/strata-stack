import type { NewsletterAudience } from './newsletter';
import { getEnv } from './env';

/**
 * Resend audience as the newsletter's provider mirror. Confirmed addresses are created (or
 * marked subscribed again) and unsubscribed ones are marked as such, never deleted, so the
 * audience keeps the provider-side suppression list intact.
 */
export function createResendAudience(apiKey: string, audienceId: string): NewsletterAudience {
  async function client() {
    const { Resend } = await import('resend');
    return new Resend(apiKey);
  }
  return {
    async add(email) {
      const resend = await client();
      const created = await resend.contacts.create({ audienceId, email, unsubscribed: false });
      if (!created.error) return;
      // The address may already be in the audience (an earlier subscription): flip the flag.
      const updated = await resend.contacts.update({ audienceId, email, unsubscribed: false });
      if (updated.error) throw new Error(updated.error.message);
    },
    async remove(email) {
      const resend = await client();
      const { error } = await resend.contacts.update({ audienceId, email, unsubscribed: true });
      if (error) throw new Error(error.message);
    },
  };
}

/**
 * The audience configured through `RESEND_API_KEY` and `RESEND_AUDIENCE_ID`, or null when
 * either is missing. Subscribers are always stored in the database; the audience is optional.
 */
export function getNewsletterAudience(): NewsletterAudience | null {
  const apiKey = getEnv('RESEND_API_KEY');
  const audienceId = getEnv('RESEND_AUDIENCE_ID');
  return apiKey && audienceId ? createResendAudience(apiKey, audienceId) : null;
}
