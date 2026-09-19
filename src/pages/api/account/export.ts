import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { account, contactMessages, session } from '@/db/schema';
import { recordAudit } from '@/lib/admin';
import { getAuthoritativeSession } from '@/lib/session';

export const prerender = false;

/**
 * Data export for the signed-in user (privacy "right of access"). Returns the profile,
 * linked sign-in methods and sessions without any tokens or secrets, plus contact messages
 * sent from the address when it has been verified as the user's own.
 */
export const GET: APIRoute = async ({ request }) => {
  // Personal data leaves the system here, so the session is verified against the database
  // rather than the cookie cache (a revoked session must not be able to export).
  const { user } = await getAuthoritativeSession(request.headers);
  if (!user) {
    return Response.json({ error: 'Sign in to export your data.' }, { status: 401 });
  }

  const [accounts, sessions, messages] = await Promise.all([
    db
      .select({
        providerId: account.providerId,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      })
      .from(account)
      .where(eq(account.userId, user.id)),
    db
      .select({
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      })
      .from(session)
      .where(eq(session.userId, user.id)),
    user.emailVerified
      ? db
          .select({
            id: contactMessages.id,
            name: contactMessages.name,
            email: contactMessages.email,
            message: contactMessages.message,
            status: contactMessages.status,
            createdAt: contactMessages.createdAt,
          })
          .from(contactMessages)
          .where(eq(contactMessages.email, user.email.toLowerCase()))
      : Promise.resolve([]),
  ]);

  await recordAudit(db, {
    actorId: user.id,
    actorEmail: user.email,
    action: 'account.export',
    targetType: 'user',
    targetId: user.id,
  });

  const exportedAt = new Date();
  const body = {
    exportedAt: exportedAt.toISOString(),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image ?? null,
      role: user.role ?? 'user',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    accounts,
    sessions,
    contactMessages: messages,
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="account-export-${exportedAt.toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  });
};
