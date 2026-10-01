import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { betterAuth } from 'better-auth/minimal';
import { admin, haveIBeenPwned, magicLink, twoFactor } from 'better-auth/plugins';
import { and, eq } from 'drizzle-orm';

import { db } from '../db/client';
import * as schema from '../db/schema/index';
import { siteConfig } from '../site.config';

import { forgetTrustedDevices, LAST_ADMIN_MESSAGE, notLastActiveAdmin, recordAudit } from './admin';
import { isEmailConfigured, sendEmail } from './email';
import { getAdminEmails, getEnv, getSiteUrl, getTrustedOrigins } from './env';
import { normaliseName, ProfileValidationError, validateProfileUpdate } from './profile';

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

/**
 * Better Auth server instance.
 *
 * - Uses `better-auth/minimal` because the Drizzle adapter replaces the built-in Kysely
 *   layer, which keeps serverless bundles small.
 * - Reads configuration through `process.env` (see src/lib/env.ts) so the `auth generate`
 *   CLI can load this file and every runtime behaves the same.
 * - Social providers are only registered when their credentials exist, so the template
 *   works out of the box with email and password alone.
 * - Email verification, password reset and magic links depend on an email provider
 *   (`RESEND_API_KEY`). Verification is only *required* when one is configured, so a fresh
 *   clone can still sign in; see docs/guides/authentication.
 */
export const auth = betterAuth({
  appName: siteConfig.name,
  baseURL: getSiteUrl(),
  secret: getEnv('BETTER_AUTH_SECRET'),
  trustedOrigins: getTrustedOrigins(),

  database: drizzleAdapter(db, { provider: 'sqlite', schema }),

  emailAndPassword: {
    enabled: true,
    // Length is the floor; the haveIBeenPwned plugin below refuses passwords from known breaches.
    minPasswordLength: 12,
    // Only enforce ownership of the address when a verification email can actually be
    // delivered; without a provider nobody could ever sign in.
    requireEmailVerification: emailConfigured,
    revokeSessionsOnPasswordReset: true,
    // A browser trusted for two-factor authentication must not outlive the password it was
    // trusted under: a reset is how someone takes an account back.
    onPasswordReset: async ({ user }) => {
      await forgetTrustedDevices(db, user.id);
    },
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
    // The link proves that whoever clicked it owns the mailbox, not that they chose the
    // password. Signing the clicker in would hand the mailbox owner a session on an account
    // somebody else may have registered in their name (with a password that person knows), and
    // nothing would look wrong. They sign in with the password instead, and if they do not
    // have one the reset flow makes the account theirs and revokes every other session.
    autoSignInAfterVerification: false,
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
      // without anyone who can reach /admin (recovery would need `pnpm admin:promote`). The
      // guard is a conditional write, not a read: two administrators deleting themselves at
      // the same moment would otherwise both pass a check and leave nobody.
      beforeDelete: async (user) => {
        const [demoted] = await db
          .update(schema.user)
          .set({ role: 'user' })
          .where(and(eq(schema.user.id, user.id), notLastActiveAdmin(user.id)))
          .returning({ id: schema.user.id });
        if (!demoted) {
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

  hooks: {
    // Deleting a password account always needs the password. Better Auth accepts a deletion
    // without one from any session younger than a day; for an account that has a password
    // that is a stolen cookie or an unattended browser away from erasing everything.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/delete-user') return;
      const body = (ctx.body ?? {}) as { password?: unknown; token?: unknown };
      if (body.password || body.token) return;
      const session = await getSessionFromCtx(ctx);
      if (!session) return;
      const [credential] = await db
        .select({ id: schema.account.id })
        .from(schema.account)
        .where(
          and(
            eq(schema.account.userId, session.user.id),
            eq(schema.account.providerId, 'credential'),
          ),
        )
        .limit(1);
      if (credential) {
        throw new APIError('BAD_REQUEST', {
          message: 'Enter your password to delete the account.',
        });
      }
    }),
    // Two-factor changes are privacy-relevant: record who turned it on (the first code
    // verified while signed in completes the setup), regenerated the backup codes or turned
    // it off. Best-effort, like the other Better Auth operations.
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.context.returned instanceof APIError) return;
      const user = ctx.context.session?.user as
        { id: string; email: string; twoFactorEnabled?: boolean | null } | undefined;
      if (!user) return;
      const record = (
        action: 'two_factor.enable' | 'two_factor.disable' | 'two_factor.backup_codes',
      ) =>
        recordAudit(db, {
          actorId: user.id,
          actorEmail: user.email,
          action,
          targetType: 'user',
          targetId: user.id,
        });
      switch (ctx.path) {
        case '/two-factor/verify-totp':
          // The session was read before the request, so this is the state the user started
          // from: only the code that completes the setup is an "enable".
          if (!user.twoFactorEnabled) await record('two_factor.enable');
          return;
        case '/two-factor/generate-backup-codes':
          await record('two_factor.backup_codes');
          return;
        case '/two-factor/disable':
          // Trusted browsers would otherwise skip the second step if it is turned on again.
          await forgetTrustedDevices(db, user.id);
          await record('two_factor.disable');
          return;
        case '/change-password':
        case '/revoke-other-sessions':
        case '/revoke-sessions':
          // Recovery steps. A browser an intruder marked as trusted would otherwise keep
          // skipping the second factor for thirty days, however often the password changes.
          await forgetTrustedDevices(db, user.id);
          return;
        default:
          return;
      }
    }),
  },

  databaseHooks: {
    user: {
      create: {
        // Bootstrap administrators from ADMIN_EMAILS; everyone else gets the default role. The
        // name is normalised and capped here because the sign-up schema accepts any string,
        // and social providers supply names of their own.
        before: async (user) => {
          const data = { ...user };
          if (typeof user.name === 'string') data.name = normaliseName(user.name);
          if (adminEmails.includes(user.email.toLowerCase())) data.role = 'admin';
          return { data };
        },
      },
      update: {
        // The profile form (name, avatar URL) is validated here, where every client ends up:
        // `updateUser` accepts any string for `image`, and an avatar is rendered as an <img>
        // on every page. Other updates (roles, bans) carry neither field and pass through.
        before: async (user) => {
          if (user.name === undefined && user.image === undefined) return undefined;
          try {
            return { data: { ...user, ...validateProfileUpdate(user) } };
          } catch (error) {
            if (error instanceof ProfileValidationError) {
              throw new APIError('BAD_REQUEST', { message: error.message });
            }
            throw error;
          }
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
    // Time-based one-time passwords with backup codes. Only password sign-ins are challenged:
    // a magic link or a social provider already proves possession of the mailbox or account.
    // The TOTP secret and the backup codes are stored encrypted with BETTER_AUTH_SECRET.
    twoFactor({
      issuer: siteConfig.name,
      backupCodeOptions: { amount: 10, length: 10, storeBackupCodes: 'encrypted' },
    }),
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
    // Refuses a new password that appears in Have I Been Pwned's breach corpus, at sign-up,
    // password change and reset. Only the first five characters of the password's SHA-1 hash
    // leave the server (k-anonymity range query). The check fails closed: if the service cannot
    // be reached the password is not accepted, so PASSWORD_BREACH_CHECK=false turns it off for
    // deployments that cannot make that call.
    haveIBeenPwned({
      enabled: getEnv('PASSWORD_BREACH_CHECK') !== 'false',
      customPasswordCompromisedMessage:
        'That password appears in a known data breach. Choose a different one.',
    }),
  ],

  session: {
    // Cache the session in a signed cookie to avoid a database read on every request. Access
    // decisions bypass it (src/lib/session.ts); a minute bounds how long Better Auth's own
    // profile and two-factor endpoints keep serving a revoked or banned session.
    cookieCache: { enabled: true, maxAge: 60 },
  },

  rateLimit: {
    enabled: true,
    // Memory storage resets on every serverless invocation; the database persists.
    // Better Auth additionally applies stricter built-in limits to sign-in, sign-up,
    // password and verification endpoints (3 requests per 10 or 60 seconds).
    storage: 'database',
    window: 60,
    max: 100,
    // The end-to-end suite creates several accounts from one address in parallel and walks
    // through the two-factor flow in seconds, which the built-in sign-up/sign-in and
    // two-factor rules (3 per 10 s) would reject. Test runs only.
    ...(getEnv('NODE_ENV') === 'test'
      ? {
          customRules: {
            '/sign-up/email': { window: 10, max: 50 },
            '/sign-in/email': { window: 10, max: 50 },
            '/two-factor/*': { window: 10, max: 50 },
          },
        }
      : {}),
  },

  advanced: {
    database: { joins: true },
  },
});

/** Social providers that are configured, used to render sign-in buttons. */
function enabledSocialProviders(): Array<'github' | 'google'> {
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
