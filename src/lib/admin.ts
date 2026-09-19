import { eq, like } from 'drizzle-orm';

import type { DbExecutor } from '../db/client';
import { auditLog } from '../db/schema/app';
import { user as userTable } from '../db/schema/auth';

/**
 * Whether the user may access `/admin` and the admin actions. Better Auth stores several
 * roles as a comma-separated string.
 */
export function isAdmin(user: { role?: string | null | undefined } | null | undefined): boolean {
  return (user?.role ?? '').split(',').some((role) => role.trim() === 'admin');
}

/** Administrators who can currently sign in: the role includes `admin` and the account is not banned. */
async function countActiveAdmins(db: DbExecutor, excludeUserId?: string): Promise<number> {
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

export type AuditAction =
  | 'account.delete'
  | 'account.export'
  | 'message.status'
  | 'message.delete'
  | 'message.retry_delivery'
  | 'user.set_role'
  | 'user.ban'
  | 'user.unban'
  | 'user.revoke_sessions'
  | 'user.delete';

export interface AuditEntry {
  actorId?: string | null | undefined;
  actorEmail?: string | null | undefined;
  action: AuditAction;
  targetType?: 'user' | 'message' | undefined;
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
