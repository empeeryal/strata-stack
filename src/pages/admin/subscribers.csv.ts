import type { APIRoute } from 'astro';
import { asc, eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { newsletterSubscribers } from '@/db/schema';
import { isAdmin, recordAudit } from '@/lib/admin';
import { getSiteUrl } from '@/lib/env';
import { unsubscribeUrl } from '@/lib/newsletter';
import { getAuthoritativeSession } from '@/lib/session';

export const prerender = false;

/** Quotes a CSV field when it contains a separator, a quote or a line break. */
function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/**
 * Confirmed subscribers as CSV, for sending a newsletter from outside the provider's audience.
 * Each row carries the address's unsubscribe link, which the newsletter footer must include.
 * Administrators only, authorized like the admin pages; every download is audited because a
 * list of addresses leaves the system.
 */
export const GET: APIRoute = async ({ request, redirect }) => {
  const { user } = await getAuthoritativeSession(request.headers);
  if (!user) return redirect('/login?next=%2Fadmin%2Fsubscribers');
  if (!isAdmin(user)) return new Response(null, { status: 404 });

  const siteUrl = getSiteUrl();
  const rows = await db
    .select({
      email: newsletterSubscribers.email,
      confirmedAt: newsletterSubscribers.confirmedAt,
      token: newsletterSubscribers.token,
    })
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.status, 'confirmed'))
    .orderBy(asc(newsletterSubscribers.confirmedAt));

  await recordAudit(db, {
    actorId: user.id,
    actorEmail: user.email,
    action: 'subscribers.export',
    targetType: 'newsletter',
    details: { count: rows.length },
  });

  const lines = [
    'email,confirmed_at,unsubscribe_url',
    ...rows.map((row) =>
      [
        csvField(row.email),
        row.confirmedAt ? row.confirmedAt.toISOString() : '',
        csvField(unsubscribeUrl(siteUrl, row.token)),
      ].join(','),
    ),
  ];
  const date = new Date().toISOString().slice(0, 10);
  return new Response(`${lines.join('\r\n')}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="subscribers-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
};
