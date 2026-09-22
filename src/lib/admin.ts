import { and, eq, like, sql, type SQL } from 'drizzle-orm';

import type { Database, DbExecutor } from '../db/client';
import { auditLog } from '../db/schema/app';
import {
  account as accountTable,
  session as sessionTable,
  user as userTable,
} from '../db/schema/auth';

/**
 * Whether the user may access `/admin` and the admin actions. Better Auth stores several
 * roles as a comma-separated string.
 */
export function isAdmin(user: { role?: string | null | undefined } | null | undefined): boolean {
  return (user?.role ?? '').split(',').some((role) => role.trim() === 'admin');
}

/**
 * Administrators who can currently sign in: the role includes `admin` (Better Auth may store
 * several roles as a comma-separated list) and the account is not banned. The same rule as
 * `isAdmin()`, so the overview statistic and the last-admin protection agree with authorization.
 */
export async function countActiveAdmins(db: DbExecutor, excludeUserId?: string): Promise<number> {
  const rows = await db
    .select({ id: userTable.id, role: userTable.role, banned: userTable.banned })
    .from(userTable)
    .where(like(userTable.role, '%admin%'));
  return rows.filter((row) => row.id !== excludeUserId && isAdmin(row) && !row.banned).length;
}

/** True when removing this user's access would leave the site without an administrator. */
export async function isLastActiveAdmin(db: DbExecutor, userId: string): Promise<boolean> {
  const [target] = await db
    .select({ role: userTable.role, banned: userTable.banned })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  if (!target || !isAdmin(target) || target.banned) return false;
  return (await countActiveAdmins(db, userId)) === 0;
}

export const LAST_ADMIN_MESSAGE =
  'This is the only administrator account. Make someone else an administrator first.';

/** Thrown when a change would leave the deployment without an active administrator. */
export class LastAdminError extends Error {
  constructor() {
    super(LAST_ADMIN_MESSAGE);
    this.name = 'LastAdminError';
  }
}

/** Thrown when the account an operation targets does not exist. */
export class UserNotFoundError extends Error {
  constructor() {
    super('User not found.');
    this.name = 'UserNotFoundError';
  }
}

/** The `isAdmin()` rule in SQL: the comma-separated role list contains `admin` (spaces ignored). */
const ADMIN_ROLE_PATTERN = `'%,admin,%'`;

/**
 * Condition under which `userId` may lose access: it is not an active administrator, or
 * another active administrator exists. SQLite evaluates it inside the statement that makes
 * the change, so two administrators demoting, banning or deleting each other at the same
 * moment cannot both succeed: the second statement sees the first one's result. This is what
 * `isLastActiveAdmin()` checks in application code, made atomic.
 */
export function notLastActiveAdmin(userId: string): SQL {
  return sql`(
    not (
      (',' || replace(coalesce(${userTable.role}, ''), ' ', '') || ',') like ${sql.raw(ADMIN_ROLE_PATTERN)}
      and coalesce(${userTable.banned}, 0) = 0
    )
    or exists (
      select 1 from ${userTable} as other
      where other.id <> ${userId}
        and (',' || replace(coalesce(other.role, ''), ' ', '') || ',') like ${sql.raw(ADMIN_ROLE_PATTERN)}
        and coalesce(other.banned, 0) = 0
    )
  )`;
}

/** Who performs an administrative change, for the audit log. */
export interface AdminActor {
  id: string;
  email: string;
}

/**
 * Sets a user's role. A demotion is refused when the user is the last active administrator,
 * by the same statement that would perform it. The audit entry shares the transaction.
 */
export async function changeUserRole(
  db: Database,
  actor: AdminActor,
  targetId: string,
  role: 'user' | 'admin',
): Promise<void> {
  await db.transaction(async (tx) => {
    const where =
      role === 'admin'
        ? eq(userTable.id, targetId)
        : and(eq(userTable.id, targetId), notLastActiveAdmin(targetId));
    const updated = await tx
      .update(userTable)
      .set({ role })
      .where(where)
      .returning({ id: userTable.id });
    if (updated.length === 0) await explainRefusal(tx, targetId);
    await writeAudit(tx, {
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'user.set_role',
      targetType: 'user',
      targetId,
      details: { role },
    });
  });
}

/**
 * Bans a user and signs them out everywhere. Refused for the last active administrator by the
 * same statement that would perform it. The audit entry shares the transaction.
 */
export async function banUserAccount(
  db: Database,
  actor: AdminActor,
  targetId: string,
  reason?: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(userTable)
      .set({ banned: true, banReason: reason ?? null, banExpires: null })
      .where(and(eq(userTable.id, targetId), notLastActiveAdmin(targetId)))
      .returning({ id: userTable.id });
    if (updated.length === 0) await explainRefusal(tx, targetId);
    await tx.delete(sessionTable).where(eq(sessionTable.userId, targetId));
    await writeAudit(tx, {
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'user.ban',
      targetType: 'user',
      targetId,
      details: { reason: reason ?? null },
    });
  });
}

/**
 * Deletes a user with their sessions and linked accounts. Refused for the last active
 * administrator by the same statement that would perform it. The audit entry shares the
 * transaction. Contact messages are keyed by address, not user, and stay in the inbox.
 */
export async function deleteUserAccount(
  db: Database,
  actor: AdminActor,
  targetId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(userTable)
      .where(and(eq(userTable.id, targetId), notLastActiveAdmin(targetId)))
      .returning({ id: userTable.id });
    if (deleted.length === 0) await explainRefusal(tx, targetId);
    // The foreign keys cascade when SQLite enforces them; delete explicitly so the outcome
    // does not depend on the connection's pragma.
    await tx.delete(sessionTable).where(eq(sessionTable.userId, targetId));
    await tx.delete(accountTable).where(eq(accountTable.userId, targetId));
    await writeAudit(tx, {
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'user.delete',
      targetType: 'user',
      targetId,
    });
  });
}

/** Explains a guarded statement that changed nothing: the user is unknown or the last admin. */
async function explainRefusal(tx: DbExecutor, targetId: string): Promise<never> {
  const [row] = await tx
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.id, targetId))
    .limit(1);
  throw row ? new LastAdminError() : new UserNotFoundError();
}

/** Every action the audit log records; the admin page offers them as a filter. */
export const AUDIT_ACTIONS = [
  'account.delete',
  'account.export',
  'message.status',
  'message.delete',
  'message.retry_delivery',
  'user.set_role',
  'user.ban',
  'user.unban',
  'user.revoke_sessions',
  'user.delete',
  'session.revoke',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditEntry {
  actorId?: string | null | undefined;
  actorEmail?: string | null | undefined;
  action: AuditAction;
  targetType?: 'user' | 'message' | 'session' | undefined;
  targetId?: string | null | undefined;
  /** JSON-serialisable context. Never include secrets or message bodies. */
  details?: unknown;
}

/**
 * Appends an entry to the audit log and throws when the write fails. Use it inside a
 * transaction together with the change it describes, so neither exists without the other.
 */
export async function writeAudit(db: DbExecutor, entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    id: crypto.randomUUID(),
    actorId: entry.actorId ?? null,
    actorEmail: entry.actorEmail ?? null,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    details: entry.details === undefined ? null : JSON.stringify(entry.details),
  });
}

/**
 * Best-effort variant for changes that cannot share a transaction with the log (Better Auth
 * user operations, email, exports): the change stands even if the entry cannot be written,
 * and the failure is reported on the server log instead.
 */
export async function recordAudit(db: DbExecutor, entry: AuditEntry): Promise<void> {
  try {
    await writeAudit(db, entry);
  } catch (error) {
    console.error('[audit] could not record entry', entry.action, error);
  }
}
