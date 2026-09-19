import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { APIError } from 'better-auth/api';
import { betterAuth } from 'better-auth/minimal';
import { admin, magicLink } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';

import { db } from '../db/client';
import * as schema from '../db/schema/index';
import { siteConfig } from '../site.config';

import { isLastActiveAdmin, LAST_ADMIN_MESSAGE, recordAudit } from './admin';
import { isEmailConfigured, sendEmail } from './email';
import { getAdminEmails, getEnv, getSiteUrl, getTrustedOrigins } from './env';

/**
 * Better Auth server instance.
 *
 * - Uses `better-auth/minimal` because the Drizzle adapter replaces the built-in
 *   Kysely layer, which keeps serverless bundles small.
 * - Reads configuration through `process.env` (see src/lib/env.ts) so the
 *   `auth generate` CLI can load this file and every runtime behaves the same.
 * - Social providers are only registered when their credentials exist, so the
 *   template works out of the box with email/password alone.
 * - Email verification, password reset and magic links depend on an email provider
 *   (`RESEND_API_KEY`). Verification is only *required* when one is configured, so a
 *   fresh clone can still sign in; see docs/guides/authentication.
 */
const githubId = getEnv('GITHUB_CLIENT_ID');
const githubSecret = getEnv('GITHUB_CLIENT_SECRET');
const googleId = getEnv('GOOGLE_CLIENT_ID');
const googleSecret = getEnv('GOOGLE_CLIENT_SECRET');
const emailConfigured = isEmailConfigured();
const adminEmails = getAdminEmails();

/** Sends without awaiting so response timing never reveals whether an address exists. */
function sendInBackground(message: Parameters<typeof sendEmail>[0], what: string): void {
  void sendEmail(message).catch((error: unknown) => {
    console.error(`[auth] could not send ${what}`, error);
  });
}

export const auth = betterAuth({
  appName: siteConfig.name,
  baseURL: getSiteUrl(),
  secret: getEnv('BETTER_AUTH_SECRET'),
  trustedOrigins: getTrustedOrigins(),

  database: drizzleAdapter(db, { provider: 'sqlite', schema }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Only enforce ownership of the address when a verification email can actually be
    // delivered; without a provider nobody could ever sign in.
    requireEmailVerification: emailConfigured,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      sendInBackground(
        {
          to: user.email,
          subject: `Reset your ${siteConfig.name} password`,
          text: `Open this link to choose a new password:\n\n${url}\n\nThe link expires in one hour. If you did not request a reset, you can ignore this email.`,
          html: `<p>Open this link to choose a new password for <strong>${siteConfig.name}</strong>:</p><p><a href="${url}">${url}</a></p><p>The link expires in one hour. If you did not request a reset, you can ignore this email.</p>`,
        },
        'password reset email',
      );
    },
    // With verification enabled the sign-up response is synthetic for existing addresses
    // (enumeration protection); it must carry the admin plugin's fields to be
    // indistinguishable from a real user.
    customSyntheticUser: ({ coreFields, additionalFields, id }) => ({
      ...coreFields,
      role: 'user',
      banned: false,
      banReason: null,
      banExpires: null,
      ...additionalFields,
      id,
    }),
  },

  emailVerification: {
    sendOnSignUp: emailConfigured,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      sendInBackground(
        {
          to: user.email,
          subject: `Verify your email for ${siteConfig.name}`,
          text: `Confirm your email address by opening this link:\n\n${url}\n\nIf you did not create an account, you can ignore this email.`,
          html: `<p>Confirm your email address for <strong>${siteConfig.name}</strong>:</p><p><a href="${url}">${url}</a></p><p>If you did not create an account, you can ignore this email.</p>`,
        },
        'verification email',
      );
    },
  },

  user: {
    deleteUser: {
      enabled: true,
      // The last administrator cannot delete their own account: the site would be left
      // without anyone who can reach /admin (recovery would need `pnpm admin:promote`).
      beforeDelete: async (user) => {
        if (await isLastActiveAdmin(db, user.id)) {
          throw new APIError('BAD_REQUEST', { message: LAST_ADMIN_MESSAGE });
        }
      },
      // Remove the personal data this template stores outside the auth tables. Contact
      // messages are only tied to an address, so they are deleted when the address was
      // verified as belonging to this user.
      afterDelete: async (user) => {
        if (user.emailVerified) {
          await db
            .delete(schema.contactMessages)
            .where(eq(schema.contactMessages.email, user.email.toLowerCase()));
        }
        await recordAudit(db, {
          actorId: user.id,
          actorEmail: user.email,
          action: 'account.delete',
          targetType: 'user',
          targetId: user.id,
          details: { contactMessagesRemoved: user.emailVerified },
        });
      },
    },
  },

  databaseHooks: {
    user: {
      create: {
        // Bootstrap administrators from ADMIN_EMAILS; everyone else gets the default role.
        before: async (user) => {
          if (adminEmails.includes(user.email.toLowerCase())) {
            return { data: { ...user, role: 'admin' } };
          }
          return undefined;
        },
      },
    },
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
      // Awaited on purpose: the endpoint behaves the same for new and existing addresses,
      // and a delivery failure must surface to the user instead of a silent "check your inbox".
      sendMagicLink: async ({ email, url }) => {
        await sendEmail({
          to: email,
          subject: `Sign in to ${siteConfig.name}`,
          text: `Open this link to sign in to ${siteConfig.name}:\n\n${url}\n\nThe link expires in 5 minutes. If you did not request it, you can ignore this email.`,
          html: `<p>Open this link to sign in to <strong>${siteConfig.name}</strong>:</p><p><a href="${url}">${url}</a></p><p>The link expires in 5 minutes. If you did not request it, you can ignore this email.</p>`,
        });
      },
    }),
    admin(),
  ],

  session: {
    // Cache the session in a signed cookie to avoid a database read on every request.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },

  rateLimit: {
    enabled: true,
    // Memory storage resets on every serverless invocation; the database persists.
    // Better Auth additionally applies stricter built-in limits to sign-in, sign-up,
    // password and verification endpoints (3 requests per 10 or 60 seconds).
    storage: 'database',
    window: 60,
    max: 100,
    // The end-to-end suite creates several accounts from one address in parallel, which the
    // built-in sign-up/sign-in rule (3 per 10 s) would reject. Test runs only.
    ...(process.env.NODE_ENV === 'test'
      ? {
          customRules: {
            '/sign-up/email': { window: 10, max: 50 },
            '/sign-in/email': { window: 10, max: 50 },
          },
        }
      : {}),
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

/** Sign-in methods available in this deployment, for copy and conditional UI. */
export function enabledAuthMethods(): {
  password: true;
  magicLink: boolean;
  passwordReset: boolean;
  social: Array<'github' | 'google'>;
} {
  return {
    password: true,
    magicLink: emailConfigured,
    passwordReset: emailConfigured,
    social: enabledSocialProviders(),
  };
}
