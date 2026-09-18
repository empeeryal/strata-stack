import { siteConfig } from '../site.config';

import { getEnv } from './env';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Sends transactional email through Resend when RESEND_API_KEY is configured.
 * Without a key (local development, CI) the message is logged instead so flows like
 * magic-link sign-in remain testable.
 */
export async function sendEmail(message: EmailMessage): Promise<{ id: string }> {
  const apiKey = getEnv('RESEND_API_KEY');
  const from = getEnv('EMAIL_FROM') ?? `${siteConfig.name} <onboarding@resend.dev>`;

  if (!apiKey) {
    console.info(
      `[email] RESEND_API_KEY is not set; logging message instead.\n  to: ${message.to}\n  subject: ${message.subject}\n  ${message.text}`,
    );
    return { id: 'logged' };
  }

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    ...(message.html ? { html: message.html } : {}),
  });

  if (error || !data) {
    throw new Error(`Email delivery failed: ${error?.message ?? 'unknown error'}`);
  }
  return { id: data.id };
}
