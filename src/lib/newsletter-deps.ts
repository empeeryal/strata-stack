import { db } from '../db/client';
import { siteConfig } from '../site.config';

import { getNewsletterAudience } from './audience';
import { sendEmail } from './email';
import { getSiteUrl } from './env';
import type { NewsletterDeps } from './newsletter';

/** Wires the newsletter flow to the database, email delivery and the configured audience. */
export function newsletterDeps(): NewsletterDeps {
  return {
    db,
    sendEmail,
    siteName: siteConfig.name,
    siteUrl: getSiteUrl(),
    audience: getNewsletterAudience(),
  };
}
