import type { Database } from '../db/client';
import { auditLog } from '../db/schema/app';

/** The subset of a Better Auth user needed for authorization decisions. */
export interface RoleHolder {
  role?: string | null | undefined;
}

export const ADMIN_ROLE = 'admin';

/** Better Auth stores multiple roles as a comma-separated string. */
export function rolesOf(user: RoleHolder | null | undefined): string[] {
  return (user?.role ?? '')
    .split(',')
    .map((role) => role.trim())
    .filter(Boolean);
}

export function hasRole(user: RoleHolder | null | undefined, role: string): boolean {
  return rolesOf(user).includes(role);
}

/** Whether the user may access `/admin` and the admin actions. */
export function isAdmin(user: RoleHolder | null | undefined): boolean {
  return hasRole(user, ADMIN_ROLE);
}

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

/** Appends an entry to the audit log. Failures are logged, never thrown. */
export async function recordAudit(db: Database, entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLog).values({
      id: crypto.randomUUID(),
      actorId: entry.actorId ?? null,
      actorEmail: entry.actorEmail ?? null,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      details: entry.details === undefined ? null : JSON.stringify(entry.details),
    });
  } catch (error) {
    console.error('[audit] could not record entry', entry.action, error);
  }
}
