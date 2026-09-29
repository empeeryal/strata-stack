import { getEnv } from './env';
import type { NewsletterAudience } from './newsletter';

/**
 * Resend as the newsletter's provider mirror. Confirmed addresses are created as contacts in
 * the segment (called an audience in older Resend dashboards) and unsubscribed ones are marked
 * as such at the contact level, never deleted, so the provider keeps its suppression list.
 */
export function createResendAudience(apiKey: string, segmentId: string): NewsletterAudience {
  async function client() {
    const { Resend } = await import('resend');
    return new Resend(apiKey);
  }
  return {
    async add(email) {
      const resend = await client();
      const created = await resend.contacts.create({
        email,
        unsubscribed: false,
        segments: [{ id: segmentId }],
      });
      if (!created.error) return;
      // The address may already be a contact (an earlier subscription): flip the flag and
      // make sure it is in the segment.
      const updated = await resend.contacts.update({ email, unsubscribed: false });
      if (updated.error) throw new Error(updated.error.message);
      const added = await resend.contacts.segments.add({ email, segmentId });
      if (added.error) throw new Error(added.error.message);
    },
    async remove(email) {
      const resend = await client();
      const { error } = await resend.contacts.update({ email, unsubscribed: true });
      if (error) throw new Error(error.message);
    },
  };
}

/**
 * The segment configured through `RESEND_API_KEY` and `RESEND_AUDIENCE_ID`, or null when
 * either is missing. Subscribers are always stored in the database; the mirror is optional.
 */
export function getNewsletterAudience(): NewsletterAudience | null {
  const apiKey = getEnv('RESEND_API_KEY');
  const segmentId = getEnv('RESEND_AUDIENCE_ID');
  return apiKey && segmentId ? createResendAudience(apiKey, segmentId) : null;
}
