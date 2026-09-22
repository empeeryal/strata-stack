import { and, eq } from 'drizzle-orm';

import type { Database } from '../db/client';
import { session as sessionTable } from '../db/schema/auth';

import { writeAudit } from './admin';

/** Thrown when a session cannot be revoked from the dashboard. */
export class SessionRevokeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionRevokeError';
  }
}

/**
 * Signs out one of the user's other sessions. The current one is refused (use "Sign out"),
 * and a session id that does not belong to the user is reported as not found rather than
 * revealing anything. The audit entry shares the transaction.
 */
export async function revokeOwnSession(
  db: Database,
  user: { id: string; email: string },
  currentSessionId: string,
  sessionId: string,
): Promise<void> {
  if (sessionId === currentSessionId) {
    throw new SessionRevokeError('This is the session you are using; sign out instead.');
  }
  await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(sessionTable)
      .where(and(eq(sessionTable.id, sessionId), eq(sessionTable.userId, user.id)))
      .returning({ id: sessionTable.id });
    if (deleted.length === 0) throw new SessionRevokeError('That session no longer exists.');
    await writeAudit(tx, {
      actorId: user.id,
      actorEmail: user.email,
      action: 'session.revoke',
      targetType: 'session',
      targetId: sessionId,
    });
  });
}

const BROWSERS: Array<[RegExp, string]> = [
  [/Edg\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];
const SYSTEMS: Array<[RegExp, string]> = [
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
];

/**
 * A short, recognisable label for a session's user agent, such as "Chrome on macOS". Good
 * enough to tell devices apart in a list; not a fingerprint.
 */
export function describeUserAgent(userAgent: string | null | undefined): string {
  if (!userAgent) return 'Unknown device';
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1];
  if (browser && system) return `${browser} on ${system}`;
  return browser ?? system ?? 'Unknown device';
}
