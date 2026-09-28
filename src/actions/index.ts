import { ActionError, defineAction, type ActionAPIContext } from 'astro:actions';
import { z } from 'astro/zod';
import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import {
  CONTACT_STATUSES,
  contactMessages,
  newsletterSubscribers,
  type ContactStatus,
} from '@/db/schema';
import {
  banUserAccount,
  changeUserRole,
  deleteUserAccount,
  isAdmin,
  LastAdminError,
  recordAudit,
  UserNotFoundError,
  writeAudit,
} from '@/lib/admin';
import { revokeOwnSession, SessionRevokeError } from '@/lib/account';
import type { AccountNotice } from '@/lib/account-page';
import type { AdminNotice } from '@/lib/admin-page';
import { auth } from '@/lib/auth';
import {
  ContactThrottledError,
  deliverContactMessage,
  DeliveryInProgressError,
  submitContactMessage,
  type ContactDeps,
  type DeliveryOutcome,
} from '@/lib/contact';
import { sendEmail } from '@/lib/email';
import { getEnv } from '@/lib/env';
import {
  NEWSLETTER_SOURCES,
  NewsletterEmailError,
  NewsletterThrottledError,
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
} from '@/lib/newsletter';
import { newsletterDeps } from '@/lib/newsletter-deps';
import { getAuthoritativeSession } from '@/lib/session';
import { siteConfig } from '@/site.config';

function contactDeps(): ContactDeps {
  return { db, sendEmail, recipient: getEnv('CONTACT_TO_EMAIL'), siteName: siteConfig.name };
}

function clientAddress(context: ActionAPIContext): string | null {
  try {
    return context.clientAddress || null;
  } catch {
    return null;
  }
}

/** Resolves the acting admin from the database session (src/lib/session.ts) or throws. */
async function requireAdmin(context: ActionAPIContext) {
  const { user, session } = await getAuthoritativeSession(context.request.headers);
  context.locals.user = user;
  context.locals.session = session;
  if (!user) {
    throw new ActionError({ code: 'UNAUTHORIZED', message: 'Sign in to continue.' });
  }
  if (!isAdmin(user)) {
    throw new ActionError({ code: 'FORBIDDEN', message: 'Administrator access is required.' });
  }
  return user;
}

/**
 * Maps the outcomes of the guarded user operations in src/lib/admin.ts (which refuse to
 * remove the last active administrator inside the statement itself) to action errors.
 */
function toAdminError(error: unknown, fallback: string): ActionError {
  if (error instanceof LastAdminError) {
    return new ActionError({ code: 'BAD_REQUEST', message: error.message });
  }
  if (error instanceof UserNotFoundError) {
    return new ActionError({ code: 'NOT_FOUND', message: error.message });
  }
  return toActionError(error, fallback);
}

/** Turns Better Auth API errors into action errors with their original message. */
function toActionError(error: unknown, fallback: string): ActionError {
  if (error instanceof ActionError) return error;
  const message =
    error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message
      : fallback;
  return new ActionError({ code: 'BAD_REQUEST', message });
}

const userId = z.string().min(1);
const messageId = z.string().min(1);
const subscriberId = z.string().min(1);
// Tokens are 32 bytes as base64url (see generateToken in src/lib/newsletter.ts).
const newsletterToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'This link is not valid.');

const STATUS_NOTICE: Record<ContactStatus, AdminNotice> = {
  new: 'message-unread',
  read: 'message-read',
  archived: 'message-archived',
};

const DELIVERY_NOTICE: Record<DeliveryOutcome, AdminNotice> = {
  sent: 'delivery-sent',
  failed: 'delivery-failed',
  skipped: 'delivery-skipped',
};

export const server = {
  /**
   * Contact form: honeypot, per-sender throttling, storage and owner notification.
   * See src/lib/contact.ts for the behaviour and its tests.
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
      // Honeypot. Bounded rather than empty so a filled field reaches the handler,
      // which answers with a fake success instead of a validation error.
      website: z.string().max(200).optional(),
    }),
    handler: async (input, context) => {
      try {
        return await submitContactMessage(input, { ip: clientAddress(context) }, contactDeps());
      } catch (error) {
        if (error instanceof ContactThrottledError) {
          throw new ActionError({
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many messages from this sender. Please try again in a little while.',
          });
        }
        console.error('[contact] failed to store message', error);
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'We could not save your message. Please try again later.',
        });
      }
    },
  }),

  /**
   * Newsletter with double opt-in. See src/lib/newsletter.ts for the behaviour and its tests.
   * `subscribe` always answers with the same success so it cannot be used to check whether an
   * address is subscribed; the difference is in the email the address receives.
   */
  newsletter: {
    subscribe: defineAction({
      accept: 'form',
      input: z.object({
        email: z.email('Please enter a valid email address.'),
        source: z.enum(NEWSLETTER_SOURCES).optional(),
        // Honeypot; see the contact action.
        website: z.string().max(200).optional(),
      }),
      handler: async (input, context) => {
        try {
          const outcome = await subscribeToNewsletter(
            input,
            { ip: clientAddress(context) },
            newsletterDeps(),
          );
          return { ok: true as const, outcome };
        } catch (error) {
          if (error instanceof NewsletterThrottledError) {
            throw new ActionError({
              code: 'TOO_MANY_REQUESTS',
              message: 'Too many requests from this sender. Please try again in a little while.',
            });
          }
          if (error instanceof NewsletterEmailError) {
            throw new ActionError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'We could not send the confirmation email. Please try again later.',
            });
          }
          console.error('[newsletter] subscription failed', error);
          throw new ActionError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'We could not save your request. Please try again later.',
          });
        }
      },
    }),

    /** Ends the subscription the token in an email footer belongs to. */
    unsubscribe: defineAction({
      accept: 'form',
      input: z.object({ token: newsletterToken }),
      handler: async ({ token }) => {
        const outcome = await unsubscribeFromNewsletter(token, newsletterDeps());
        if (outcome === 'invalid') {
          throw new ActionError({ code: 'NOT_FOUND', message: 'This link is not valid.' });
        }
        // The page redirects back to its own URL with the token, so it renders the new state.
        return { outcome, token };
      },
    }),
  },

  /**
   * Administrative actions. Authorization is enforced here, not in the pages. Each returns
   * a `notice` key the pages show after the redirect (see src/lib/admin-page.ts).
   *
   * Message status changes and deletions write the change and the audit entry in one
   * transaction. Resending a notification and the user operations call email or Better
   * Auth and cannot share a transaction; their audit entries are best-effort (`recordAudit`).
   */
  account: {
    /** Signs out one of the caller's other sessions, chosen by id on the dashboard. */
    revokeSession: defineAction({
      accept: 'form',
      input: z.object({ id: z.string().min(1) }),
      handler: async ({ id }, context) => {
        const { user, session } = await getAuthoritativeSession(context.request.headers);
        if (!user || !session) {
          throw new ActionError({ code: 'UNAUTHORIZED', message: 'Sign in to continue.' });
        }
        try {
          await revokeOwnSession(db, user, session.id, id);
        } catch (error) {
          if (error instanceof SessionRevokeError) {
            throw new ActionError({ code: 'BAD_REQUEST', message: error.message });
          }
          throw error;
        }
        return { notice: 'session-revoked' as AccountNotice };
      },
    }),

    /** Signs out every session except the one making the request. */
    revokeOtherSessions: defineAction({
      accept: 'form',
      handler: async (_input, context) => {
        const { user } = await getAuthoritativeSession(context.request.headers);
        if (!user) {
          throw new ActionError({ code: 'UNAUTHORIZED', message: 'Sign in to continue.' });
        }
        try {
          await auth.api.revokeOtherSessions({ headers: context.request.headers });
        } catch (error) {
          throw toActionError(error, 'Could not sign out the other sessions.');
        }
        return { notice: 'sessions-revoked' as AccountNotice };
      },
    }),
  },

  admin: {
    setMessageStatus: defineAction({
      accept: 'form',
      input: z.object({ id: messageId, status: z.enum(CONTACT_STATUSES) }),
      handler: async ({ id, status }, context) => {
        const actor = await requireAdmin(context);
        const now = new Date();
        await db.transaction(async (tx) => {
          const [updated] = await tx
            .update(contactMessages)
            .set({
              status,
              ...(status === 'new' ? { readAt: null, archivedAt: null } : {}),
              ...(status === 'read' ? { readAt: now, archivedAt: null } : {}),
              ...(status === 'archived' ? { archivedAt: now } : {}),
            })
            .where(eq(contactMessages.id, id))
            .returning({ id: contactMessages.id });
          if (!updated) {
            throw new ActionError({ code: 'NOT_FOUND', message: 'Message not found.' });
          }
          await writeAudit(tx, {
            actorId: actor.id,
            actorEmail: actor.email,
            action: 'message.status',
            targetType: 'message',
            targetId: id,
            details: { status },
          });
        });
        return { status, notice: STATUS_NOTICE[status] };
      },
    }),

    deleteMessage: defineAction({
      accept: 'form',
      input: z.object({ id: messageId }),
      handler: async ({ id }, context) => {
        const actor = await requireAdmin(context);
        await db.transaction(async (tx) => {
          const [deleted] = await tx
            .delete(contactMessages)
            .where(eq(contactMessages.id, id))
            .returning({ id: contactMessages.id });
          if (!deleted) {
            throw new ActionError({ code: 'NOT_FOUND', message: 'Message not found.' });
          }
          await writeAudit(tx, {
            actorId: actor.id,
            actorEmail: actor.email,
            action: 'message.delete',
            targetType: 'message',
            targetId: id,
          });
        });
        return { notice: 'message-deleted' as AdminNotice };
      },
    }),

    retryMessageDelivery: defineAction({
      accept: 'form',
      input: z.object({ id: messageId }),
      handler: async ({ id }, context) => {
        const actor = await requireAdmin(context);
        let delivery: Awaited<ReturnType<typeof deliverContactMessage>>;
        try {
          delivery = await deliverContactMessage(id, contactDeps());
        } catch (error) {
          if (error instanceof DeliveryInProgressError) {
            throw new ActionError({ code: 'CONFLICT', message: error.message });
          }
          throw error;
        }
        if (!delivery) {
          throw new ActionError({ code: 'NOT_FOUND', message: 'Message not found.' });
        }
        await recordAudit(db, {
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'message.retry_delivery',
          targetType: 'message',
          targetId: id,
          details: { delivery },
        });
        return { delivery, notice: DELIVERY_NOTICE[delivery] };
      },
    }),

    /**
     * Deletes a newsletter address, for requests that arrive outside the unsubscribe link. A
     * confirmed address is marked unsubscribed at the provider first, best-effort, so the
     * audience does not keep sending to it.
     */
    removeSubscriber: defineAction({
      accept: 'form',
      input: z.object({ id: subscriberId }),
      handler: async ({ id }, context) => {
        const actor = await requireAdmin(context);
        const [row] = await db
          .select()
          .from(newsletterSubscribers)
          .where(eq(newsletterSubscribers.id, id))
          .limit(1);
        if (!row) {
          throw new ActionError({ code: 'NOT_FOUND', message: 'Subscriber not found.' });
        }
        const deps = newsletterDeps();
        if (row.status === 'confirmed' && deps.audience) {
          await deps.audience.remove(row.email).catch((error: unknown) => {
            console.error('[newsletter] audience remove failed', error);
          });
        }
        await db.transaction(async (tx) => {
          await tx.delete(newsletterSubscribers).where(eq(newsletterSubscribers.id, id));
          await writeAudit(tx, {
            actorId: actor.id,
            actorEmail: actor.email,
            action: 'subscriber.delete',
            targetType: 'subscriber',
            targetId: id,
            details: { status: row.status },
          });
        });
        return { notice: 'subscriber-removed' as AdminNotice };
      },
    }),

    setUserRole: defineAction({
      accept: 'form',
      input: z.object({ userId, role: z.enum(['user', 'admin']) }),
      handler: async ({ userId: targetId, role }, context) => {
        const actor = await requireAdmin(context);
        if (targetId === actor.id) {
          throw new ActionError({
            code: 'BAD_REQUEST',
            message: 'You cannot change your own role.',
          });
        }
        try {
          await changeUserRole(db, actor, targetId, role);
        } catch (error) {
          throw toAdminError(error, 'Could not update the role.');
        }
        return { notice: 'role-updated' as AdminNotice };
      },
    }),

    banUser: defineAction({
      accept: 'form',
      input: z.object({ userId, reason: z.string().trim().max(200).optional() }),
      handler: async ({ userId: targetId, reason }, context) => {
        const actor = await requireAdmin(context);
        if (targetId === actor.id) {
          throw new ActionError({ code: 'BAD_REQUEST', message: 'You cannot ban yourself.' });
        }
        try {
          await banUserAccount(db, actor, targetId, reason);
        } catch (error) {
          throw toAdminError(error, 'Could not ban the user.');
        }
        return { notice: 'user-banned' as AdminNotice };
      },
    }),

    unbanUser: defineAction({
      accept: 'form',
      input: z.object({ userId }),
      handler: async ({ userId: targetId }, context) => {
        const actor = await requireAdmin(context);
        try {
          await auth.api.unbanUser({
            body: { userId: targetId },
            headers: context.request.headers,
          });
        } catch (error) {
          throw toActionError(error, 'Could not unban the user.');
        }
        await recordAudit(db, {
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'user.unban',
          targetType: 'user',
          targetId,
        });
        return { notice: 'user-unbanned' as AdminNotice };
      },
    }),

    revokeUserSessions: defineAction({
      accept: 'form',
      input: z.object({ userId }),
      handler: async ({ userId: targetId }, context) => {
        const actor = await requireAdmin(context);
        try {
          await auth.api.revokeUserSessions({
            body: { userId: targetId },
            headers: context.request.headers,
          });
        } catch (error) {
          throw toActionError(error, 'Could not revoke the sessions.');
        }
        await recordAudit(db, {
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'user.revoke_sessions',
          targetType: 'user',
          targetId,
        });
        return { notice: 'sessions-revoked' as AdminNotice };
      },
    }),

    removeUser: defineAction({
      accept: 'form',
      input: z.object({ userId }),
      handler: async ({ userId: targetId }, context) => {
        const actor = await requireAdmin(context);
        if (targetId === actor.id) {
          throw new ActionError({
            code: 'BAD_REQUEST',
            message: 'Delete your own account from the dashboard instead.',
          });
        }
        try {
          await deleteUserAccount(db, actor, targetId);
        } catch (error) {
          throw toAdminError(error, 'Could not delete the user.');
        }
        return { notice: 'user-deleted' as AdminNotice };
      },
    }),
  },
};
