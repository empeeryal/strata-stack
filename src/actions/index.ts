import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';

import { db } from '@/db/client';
import { contactMessages } from '@/db/schema';
import { sendEmail } from '@/lib/email';
import { getEnv } from '@/lib/env';
import { siteConfig } from '@/site.config';

export const server = {
  /**
   * Contact form: validates input, stores the message and emails the site owner.
   * The `website` field is a honeypot that real users never see.
   */
  contact: defineAction({
    accept: 'form',
    input: z.object({
      name: z.string().trim().min(2, 'Please enter your name.').max(80),
      email: z.email('Please enter a valid email address.'),
      message: z
        .string()
        .trim()
        .min(10, 'Tell us a little more (at least 10 characters).')
        .max(2000),
      website: z.string().max(0).optional(),
    }),
    handler: async (input) => {
      if (input.website) {
        // Bot filled the honeypot: pretend it worked.
        return { ok: true as const };
      }

      try {
        await db.insert(contactMessages).values({
          id: crypto.randomUUID(),
          name: input.name,
          email: input.email,
          message: input.message,
        });
      } catch (error) {
        console.error('[contact] failed to store message', error);
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'We could not save your message. Please try again later.',
        });
      }

      const to = getEnv('CONTACT_TO_EMAIL');
      if (to) {
        await sendEmail({
          to,
          subject: `[${siteConfig.name}] Contact form: ${input.name}`,
          text: `From: ${input.name} <${input.email}>\n\n${input.message}`,
        });
      }

      return { ok: true as const };
    },
  }),
};
