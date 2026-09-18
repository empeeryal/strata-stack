import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth/minimal';
import { magicLink } from 'better-auth/plugins';

import { db } from '../db/client';
import * as schema from '../db/schema/index';
import { siteConfig } from '../site.config';

import { sendEmail } from './email';
import { getEnv, getSiteUrl, getTrustedOrigins } from './env';

/**
 * Better Auth server instance.
 *
 * - Uses `better-auth/minimal` because the Drizzle adapter replaces the built-in
 *   Kysely layer, which keeps serverless bundles small.
 * - Reads configuration through `process.env` (see src/lib/env.ts) so the
 *   `auth generate` CLI can load this file and every runtime behaves the same.
 * - Social providers are only registered when their credentials exist, so the
 *   template works out of the box with email/password alone.
 */
const githubId = getEnv('GITHUB_CLIENT_ID');
const githubSecret = getEnv('GITHUB_CLIENT_SECRET');
const googleId = getEnv('GOOGLE_CLIENT_ID');
const googleSecret = getEnv('GOOGLE_CLIENT_SECRET');

export const auth = betterAuth({
  appName: siteConfig.name,
  baseURL: getSiteUrl(),
  secret: getEnv('BETTER_AUTH_SECRET'),
  trustedOrigins: getTrustedOrigins(),

  database: drizzleAdapter(db, { provider: 'sqlite', schema }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Set to true once email delivery is configured (RESEND_API_KEY).
    requireEmailVerification: false,
  },

  socialProviders: {
    ...(githubId && githubSecret
      ? { github: { clientId: githubId, clientSecret: githubSecret } }
      : {}),
    ...(googleId && googleSecret
      ? { google: { clientId: googleId, clientSecret: googleSecret } }
      : {}),
  },

  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendEmail({
          to: email,
          subject: `Sign in to ${siteConfig.name}`,
          text: `Open this link to sign in to ${siteConfig.name}:\n\n${url}\n\nThe link expires in 5 minutes. If you did not request it, you can ignore this email.`,
          html: `<p>Open this link to sign in to <strong>${siteConfig.name}</strong>:</p><p><a href="${url}">${url}</a></p><p>The link expires in 5 minutes. If you did not request it, you can ignore this email.</p>`,
        });
      },
    }),
  ],

  session: {
    // Cache the session in a signed cookie to avoid a database read on every request.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },

  rateLimit: {
    enabled: true,
    // Memory storage resets on every serverless invocation; the database persists.
    storage: 'database',
    window: 60,
    max: 100,
  },

  advanced: {
    database: { joins: true },
  },
});

export type Auth = typeof auth;

/** Social providers that are configured, used to render sign-in buttons. */
export function enabledSocialProviders(): Array<'github' | 'google'> {
  const providers: Array<'github' | 'google'> = [];
  if (githubId && githubSecret) providers.push('github');
  if (googleId && googleSecret) providers.push('google');
  return providers;
}
