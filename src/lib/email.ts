import { siteConfig } from '../site.config';

import { getEnv, isProduction } from './env';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** True when a transactional email provider is available. */
export function isEmailConfigured(): boolean {
  return Boolean(getEnv('RESEND_API_KEY'));
}

/**
 * Sends transactional email through Resend when RESEND_API_KEY is configured.
 *
 * Without a key the behaviour depends on the environment:
 * - development and test: the message (including any sign-in link) is printed to the
 *   console so flows like magic-link sign-in stay testable offline;
 * - production: the call throws. Sign-in links and reset tokens are bearer credentials
 *   and must never end up in production logs.
 */
export async function sendEmail(message: EmailMessage): Promise<{ id: string }> {
  const apiKey = getEnv('RESEND_API_KEY');
  const from = getEnv('EMAIL_FROM') ?? `${siteConfig.name} <onboarding@resend.dev>`;

  if (!apiKey) {
    if (isProduction) {
      throw new Error('Email delivery is not configured. Set RESEND_API_KEY to send email.');
    }
    console.info(
      `[email] RESEND_API_KEY is not set; printing the message instead (development only).\n  to: ${message.to}\n  subject: ${message.subject}\n  ${message.text}`,
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
