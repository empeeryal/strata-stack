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
      // Look first: Resend does not promise an error for creating a contact that exists, and a
      // contact from an earlier subscription may be marked unsubscribed or sit outside the
      // segment, which a create call would leave as it is.
      const existing = await resend.contacts.get({ email });
      if (existing.error) {
        const created = await resend.contacts.create({
          email,
          unsubscribed: false,
          segments: [{ id: segmentId }],
        });
        if (!created.error) return;
        throw new Error(created.error.message);
      }
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
 * Reads `process.env` directly (an empty value counts as unset) so the retention script can
 * load this module outside Astro.
 */
export function getNewsletterAudience(
  env: NodeJS.ProcessEnv = process.env,
): NewsletterAudience | null {
  const apiKey = env.RESEND_API_KEY || undefined;
  const segmentId = env.RESEND_AUDIENCE_ID || undefined;
  return apiKey && segmentId ? createResendAudience(apiKey, segmentId) : null;
}
