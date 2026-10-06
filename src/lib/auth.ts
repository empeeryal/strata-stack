import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { passkey } from '@better-auth/passkey';
import { APIError, createAuthMiddleware, getSessionFromCtx, isAPIError } from 'better-auth/api';
import { betterAuth } from 'better-auth/minimal';
import { admin, haveIBeenPwned, magicLink, twoFactor } from 'better-auth/plugins';
import { and, eq } from 'drizzle-orm';

import { db } from '../db/client';
import * as schema from '../db/schema/index';
import { siteConfig } from '../site.config';

import {
  type AuditAction,
  forgetTrustedDevices,
  LAST_ADMIN_MESSAGE,
  notLastActiveAdmin,
  recordAudit,
} from './admin';
import { isEmailConfigured, sendEmail } from './email';
import { appliesEmailChange, readEmailChangeToken } from './email-change';
import { getAdminEmails, getEnv, getSiteUrl, getTrustedOrigins } from './env';
import { PASSKEY_NAME_MAX_LENGTH } from './passkeys';
import { normaliseName, ProfileValidationError, validateProfileUpdate } from './profile';

const githubId = getEnv('GITHUB_CLIENT_ID');
const githubSecret = getEnv('GITHUB_CLIENT_SECRET');
const googleId = getEnv('GOOGLE_CLIENT_ID');
const googleSecret = getEnv('GOOGLE_CLIENT_SECRET');
const emailConfigured = isEmailConfigured();
const adminEmails = getAdminEmails();
const siteUrl = getSiteUrl();

/**
 * The stored form of a name. A magic link creates an account from the address alone, so an
 * empty name falls back to the part before the @ (the dashboard greets people by name and the
 * profile form lets them change it).
 */
function defaultName(name: string, email: string): string {
  return normaliseName(name) || normaliseName(email.split('@')[0] ?? '') || 'New user';
}

/** Sends without awaiting so response timing never reveals whether an address exists. */
function sendInBackground(message: Parameters<typeof sendEmail>[0], what: string): void {
  void sendEmail(message).catch((error: unknown) => {
    console.error(`[auth] could not send ${what}`, error);
  });
}

/** The password account of a user, if they have one (social-only accounts have none). */
async function credentialAccount(userId: string) {
  const [credential] = await db
    .select({ id: schema.account.id, password: schema.account.password })
    .from(schema.account)
    .where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, 'credential')))
    .limit(1);
  return credential;
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
  baseURL: siteUrl,
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
    // indistinguishable from a real user, and its name must go through the same normalisation
    // the create hook below applies to a stored one, or the raw spacing would tell them apart.
    customSyntheticUser: ({ coreFields, additionalFields, id }) => ({
      ...coreFields,
      name: defaultName(
        typeof coreFields.name === 'string' ? coreFields.name : '',
        coreFields.email,
      ),
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
    sendVerificationEmail: async ({ user, url, token }) => {
      // The same handler verifies a new account's address and the new address of an existing
      // account (user.changeEmail below). The second case needs its own words: the recipient
      // may not have an account here, and the link gives whoever opens it a session on one.
      const change = readEmailChangeToken(token);
      sendInBackground(
        change
          ? {
              to: user.email,
              subject: `Confirm your new email address for ${siteConfig.name}`,
              text: `The ${siteConfig.name} account registered as ${change.email} asked to use this address instead. Open this link in the browser where you are signed in to confirm the change:\n\n${url}\n\nIf you did not ask for this, ignore this email; nothing changes.`,
              html: `<p>The <strong>${siteConfig.name}</strong> account registered as ${change.email} asked to use this address instead. Open this link in the browser where you are signed in to confirm the change:</p><p><a href="${url}">${url}</a></p><p>If you did not ask for this, ignore this email; nothing changes.</p>`,
            }
          : {
              to: user.email,
              subject: `Verify your email for ${siteConfig.name}`,
              text: `Confirm your email address by opening this link:\n\n${url}\n\nIf you did not create an account, you can ignore this email.`,
              html: `<p>Confirm your email address for <strong>${siteConfig.name}</strong>:</p><p><a href="${url}">${url}</a></p><p>If you did not create an account, you can ignore this email.</p>`,
            },
        'verification email',
      );
    },
    // The link to the new address is the step that changes it; record that it happened. A plain
    // verification carries no change claim and is not an account change.
    afterEmailVerification: async (user, request) => {
      if (!request) return;
      const change = readEmailChangeToken(new URL(request.url).searchParams.get('token'));
      if (!change || !appliesEmailChange(change)) return;
      if (change.updateTo.toLowerCase() !== user.email.toLowerCase()) return;
      await recordAudit(db, {
        actorId: user.id,
        actorEmail: user.email,
        action: 'account.change_email',
        targetType: 'user',
        targetId: user.id,
        details: { previousEmail: change.email },
      });
    },
  },

  user: {
    changeEmail: {
      enabled: true,
      // A verified address is changed in two steps: a confirmation link to the current address,
      // then a verification link to the new one, so a session alone cannot move an account to
      // a mailbox its owner never approved. Password accounts additionally confirm with the
      // password (a `before` hook below). Without email delivery nothing can be verified; such a
      // deployment does not verify sign-ups either, so an unverified account changes its address
      // directly, and the dashboard tells verified accounts that the change is unavailable.
      updateEmailWithoutVerification: !emailConfigured,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        sendInBackground(
          {
            to: user.email,
            subject: `Confirm the email change for your ${siteConfig.name} account`,
            text: `You asked to change the email address of your ${siteConfig.name} account to ${newEmail}. Open this link to confirm; a verification link is then sent to the new address:\n\n${url}\n\nIf you did not ask for this, do not open the link and change your password: someone else may have access to your account.`,
            html: `<p>You asked to change the email address of your <strong>${siteConfig.name}</strong> account to <strong>${newEmail}</strong>. Open this link to confirm; a verification link is then sent to the new address:</p><p><a href="${url}">${url}</a></p><p>If you did not ask for this, do not open the link and change your password: someone else may have access to your account.</p>`,
          },
          'email change confirmation',
        );
      },
    },
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
    before: createAuthMiddleware(async (ctx) => {
      // Better Auth's admin endpoints are not exposed over HTTP. The admin area works through
      // the Astro actions (src/actions/index.ts), which add what the endpoints lack: the
      // last-admin rule, the audit entry and the trusted-device cleanup. Server code still
      // reaches them through `auth.api.*`, which carries no request.
      if (ctx.request && ctx.path.startsWith('/admin/')) {
        throw new APIError('NOT_FOUND', { message: 'Not found.' });
      }
      switch (ctx.path) {
        case '/passkey/verify-registration':
        case '/passkey/update-passkey': {
          // The plugin stores a name of any length; the dashboard and the export render it.
          const { name } = (ctx.body ?? {}) as { name?: unknown };
          if (typeof name === 'string' && name.length > PASSKEY_NAME_MAX_LENGTH) {
            throw new APIError('BAD_REQUEST', {
              message: `Keep the passkey name under ${PASSKEY_NAME_MAX_LENGTH} characters.`,
            });
          }
          return;
        }
        case '/delete-user': {
          // Deleting a password account always needs the password. Better Auth accepts a
          // deletion without one from any session younger than a day; for an account that has
          // a password that is a stolen cookie or an unattended browser away from erasing
          // everything.
          const body = (ctx.body ?? {}) as { password?: unknown; token?: unknown };
          if (body.password || body.token) return;
          const session = await getSessionFromCtx(ctx);
          if (!session) return;
          if (await credentialAccount(session.user.id)) {
            throw new APIError('BAD_REQUEST', {
              message: 'Enter your password to delete the account.',
            });
          }
          return;
        }
        case '/change-email': {
          // The address is where password resets and sign-in links go, so for a password
          // account the change needs the password, not only a session. Better Auth's own
          // endpoint does not ask for one; the field travels in the body alongside the request
          // and is checked here before the endpoint runs. The endpoint's rate limit (three
          // requests per ten seconds) bounds guessing.
          const session = await getSessionFromCtx(ctx);
          if (!session) return;
          const credential = await credentialAccount(session.user.id);
          if (!credential?.password) return;
          const { password } = (ctx.body ?? {}) as { password?: unknown };
          if (typeof password !== 'string' || !password) {
            throw new APIError('BAD_REQUEST', {
              message: 'Enter your password to change the email address.',
            });
          }
          const valid = await ctx.context.password.verify({ hash: credential.password, password });
          if (!valid) throw new APIError('BAD_REQUEST', { message: 'Invalid password' });
          return;
        }
        case '/verify-email': {
          // The link that completes an email change would sign in whoever opens it. It is
          // meant for the account's owner, who requested the change a moment ago, so it only
          // works in a browser that is signed in to that account; anyone else is sent to the
          // login page and returned to the link afterwards. The first link, to the current
          // address, changes nothing and needs no session.
          const { token } = (ctx.query ?? {}) as { token?: unknown };
          const change = readEmailChangeToken(token);
          if (!change || !appliesEmailChange(change)) return;
          if (await getSessionFromCtx(ctx)) return;
          const target = ctx.request ? new URL(ctx.request.url) : null;
          const next = target ? `${target.pathname}${target.search}` : '/dashboard';
          throw ctx.redirect(
            `/login?error=sign_in_to_change_email&next=${encodeURIComponent(next)}`,
          );
        }
        default:
          return;
      }
    }),
    // Account changes that matter for privacy and recovery are recorded: who turned two-factor
    // authentication on (the first code verified while signed in completes the setup),
    // regenerated the backup codes or turned it off, added or removed a passkey, changed the
    // address. Best-effort, like the other Better Auth operations.
    after: createAuthMiddleware(async (ctx) => {
      if (isAPIError(ctx.context.returned)) return;
      const user = ctx.context.session?.user as
        { id: string; email: string; twoFactorEnabled?: boolean | null } | undefined;
      if (!user) return;
      const record = (action: AuditAction, details?: unknown) =>
        recordAudit(db, {
          actorId: user.id,
          actorEmail: user.email,
          action,
          targetType: 'user',
          targetId: user.id,
          details,
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
        case '/passkey/verify-registration':
          await record('passkey.add');
          return;
        case '/passkey/delete-passkey':
          await record('passkey.remove');
          return;
        case '/change-email': {
          // Without email delivery an unverified account changes its address right away; the
          // verified flows are recorded when the link to the new address is opened
          // (afterEmailVerification above). The response is the same either way, so the row
          // tells which happened.
          const [row] = await db
            .select({ email: schema.user.email })
            .from(schema.user)
            .where(eq(schema.user.id, user.id))
            .limit(1);
          if (row && row.email !== user.email) {
            await recordAudit(db, {
              actorId: user.id,
              actorEmail: row.email,
              action: 'account.change_email',
              targetType: 'user',
              targetId: user.id,
              details: { previousEmail: user.email },
            });
          }
          return;
        }
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
          data.name = defaultName(typeof user.name === 'string' ? user.name : '', user.email);
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
    // Passkeys (WebAuthn). The relying party is the site's hostname, so a passkey created on the
    // production domain works there and nowhere else (preview deployments sign in with a
    // password). Verification accepts the trusted origins only, not whatever Origin header the
    // request carries.
    passkey({
      rpID: new URL(siteUrl).hostname,
      rpName: siteConfig.name,
      origin: getTrustedOrigins(),
    }),
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
    customRules: {
      // Deleting a password account takes the password (hooks.before), which makes the endpoint
      // a password oracle for whoever holds a stolen cookie; the same 3 per 10 s as sign-in.
      '/delete-user': { window: 10, max: 3 },
      // The end-to-end suite creates several accounts from one address in parallel and walks
      // through the two-factor flow in seconds, which the built-in sign-up/sign-in and
      // two-factor rules (3 per 10 s) would reject. Test runs only.
      ...(getEnv('NODE_ENV') === 'test'
        ? {
            '/sign-up/email': { window: 10, max: 50 },
            '/sign-in/email': { window: 10, max: 50 },
            '/two-factor/*': { window: 10, max: 50 },
            '/delete-user': { window: 10, max: 50 },
          }
        : {}),
    },
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
