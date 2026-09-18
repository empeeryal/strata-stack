import { ActionError, defineAction, type ActionAPIContext } from 'astro:actions';
import { z } from 'astro/zod';
import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { CONTACT_STATUSES, contactMessages } from '@/db/schema';
import { isAdmin, recordAudit } from '@/lib/admin';
import { auth } from '@/lib/auth';
import {
  ContactThrottledError,
  deliverContactMessage,
  submitContactMessage,
  type ContactDeps,
} from '@/lib/contact';
import { sendEmail } from '@/lib/email';
import { getEnv } from '@/lib/env';
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

/** Resolves the acting admin or throws the matching action error. */
function requireAdmin(context: ActionAPIContext) {
  const user = context.locals.user;
  if (!user) {
    throw new ActionError({ code: 'UNAUTHORIZED', message: 'Sign in to continue.' });
  }
  if (!isAdmin(user)) {
    throw new ActionError({ code: 'FORBIDDEN', message: 'Administrator access is required.' });
  }
  return user;
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

  /** Administrative actions. Authorization is enforced here, not in the pages. */
  admin: {
    setMessageStatus: defineAction({
      accept: 'form',
      input: z.object({ id: messageId, status: z.enum(CONTACT_STATUSES) }),
      handler: async ({ id, status }, context) => {
        const actor = requireAdmin(context);
        const now = new Date();
        const [updated] = await db
          .update(contactMessages)
          .set({
            status,
            ...(status === 'read' ? { readAt: now } : {}),
            ...(status === 'archived' ? { archivedAt: now } : {}),
          })
          .where(eq(contactMessages.id, id))
          .returning({ id: contactMessages.id });
        if (!updated) {
          throw new ActionError({ code: 'NOT_FOUND', message: 'Message not found.' });
        }
        await recordAudit(db, {
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'message.status',
          targetType: 'message',
          targetId: id,
          details: { status },
        });
        return { ok: true as const };
      },
    }),

    deleteMessage: defineAction({
      accept: 'form',
      input: z.object({ id: messageId }),
      handler: async ({ id }, context) => {
        const actor = requireAdmin(context);
        const [deleted] = await db
          .delete(contactMessages)
          .where(eq(contactMessages.id, id))
          .returning({ id: contactMessages.id });
        if (!deleted) {
          throw new ActionError({ code: 'NOT_FOUND', message: 'Message not found.' });
        }
        await recordAudit(db, {
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'message.delete',
          targetType: 'message',
          targetId: id,
        });
        return { ok: true as const };
      },
    }),

    retryMessageDelivery: defineAction({
      accept: 'form',
      input: z.object({ id: messageId }),
      handler: async ({ id }, context) => {
        const actor = requireAdmin(context);
        let delivery;
        try {
          delivery = await deliverContactMessage(id, contactDeps());
        } catch (error) {
          throw toActionError(error, 'Message not found.');
        }
        await recordAudit(db, {
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'message.retry_delivery',
          targetType: 'message',
          targetId: id,
          details: { delivery },
        });
        return { ok: true as const, delivery };
      },
    }),

    setUserRole: defineAction({
      accept: 'form',
      input: z.object({ userId, role: z.enum(['user', 'admin']) }),
      handler: async ({ userId: targetId, role }, context) => {
        const actor = requireAdmin(context);
        if (targetId === actor.id) {
          throw new ActionError({
            code: 'BAD_REQUEST',
            message: 'You cannot change your own role.',
          });
        }
        try {
          await auth.api.setRole({
            body: { userId: targetId, role },
            headers: context.request.headers,
          });
        } catch (error) {
          throw toActionError(error, 'Could not update the role.');
        }
        await recordAudit(db, {
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'user.set_role',
          targetType: 'user',
          targetId,
          details: { role },
        });
        return { ok: true as const };
      },
    }),

    banUser: defineAction({
      accept: 'form',
      input: z.object({ userId, reason: z.string().trim().max(200).optional() }),
      handler: async ({ userId: targetId, reason }, context) => {
        const actor = requireAdmin(context);
        if (targetId === actor.id) {
          throw new ActionError({ code: 'BAD_REQUEST', message: 'You cannot ban yourself.' });
        }
        try {
          await auth.api.banUser({
            body: { userId: targetId, ...(reason ? { banReason: reason } : {}) },
            headers: context.request.headers,
          });
        } catch (error) {
          throw toActionError(error, 'Could not ban the user.');
        }
        await recordAudit(db, {
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'user.ban',
          targetType: 'user',
          targetId,
          details: { reason: reason ?? null },
        });
        return { ok: true as const };
      },
    }),

    unbanUser: defineAction({
      accept: 'form',
      input: z.object({ userId }),
      handler: async ({ userId: targetId }, context) => {
        const actor = requireAdmin(context);
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
        return { ok: true as const };
      },
    }),

    revokeUserSessions: defineAction({
      accept: 'form',
      input: z.object({ userId }),
      handler: async ({ userId: targetId }, context) => {
        const actor = requireAdmin(context);
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
        return { ok: true as const };
      },
    }),

    removeUser: defineAction({
      accept: 'form',
      input: z.object({ userId }),
      handler: async ({ userId: targetId }, context) => {
        const actor = requireAdmin(context);
        if (targetId === actor.id) {
          throw new ActionError({
            code: 'BAD_REQUEST',
            message: 'Delete your own account from the dashboard instead.',
          });
        }
        try {
          await auth.api.removeUser({
            body: { userId: targetId },
            headers: context.request.headers,
          });
        } catch (error) {
          throw toActionError(error, 'Could not delete the user.');
        }
        await recordAudit(db, {
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'user.delete',
          targetType: 'user',
          targetId,
        });
        return { ok: true as const };
      },
    }),
  },
};
