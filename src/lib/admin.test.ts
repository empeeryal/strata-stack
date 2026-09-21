import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { account, auditLog, session, user } from '@/db/schema';

import { createTestDb } from '../../tests/unit/db';

import {
  banUserAccount,
  changeUserRole,
  countActiveAdmins,
  deleteUserAccount,
  isAdmin,
  isLastActiveAdmin,
  LastAdminError,
  notLastActiveAdmin,
  recordAudit,
  UserNotFoundError,
  writeAudit,
} from './admin';

describe('isAdmin', () => {
  it('recognises the admin role in a comma-separated list', () => {
    expect(isAdmin({ role: 'admin' })).toBe(true);
    expect(isAdmin({ role: 'user, admin' })).toBe(true);
    expect(isAdmin({ role: 'user' })).toBe(false);
    expect(isAdmin({ role: 'administrator' })).toBe(false);
    expect(isAdmin({ role: null })).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });
});

describe('countActiveAdmins', () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>;
  beforeEach(async () => {
    testDb = await createTestDb();
  });
  afterEach(() => testDb.close());

  it('counts unbanned accounts whose roles include admin, like isAdmin()', async () => {
    await testDb.db.insert(user).values([
      { id: 'a', name: 'A', email: 'a@example.com', role: 'admin' },
      { id: 'b', name: 'B', email: 'b@example.com', role: 'user,admin' },
      { id: 'c', name: 'C', email: 'c@example.com', role: 'administrator' },
      { id: 'd', name: 'D', email: 'd@example.com', role: 'admin', banned: true },
      { id: 'e', name: 'E', email: 'e@example.com', role: 'user' },
    ]);

    expect(await countActiveAdmins(testDb.db)).toBe(2);
    expect(await countActiveAdmins(testDb.db, 'a')).toBe(1);
  });
});

describe('audit log', () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>;
  beforeEach(async () => {
    testDb = await createTestDb();
  });
  afterEach(() => testDb.close());

  it('stores the entry with JSON details', async () => {
    await recordAudit(testDb.db, {
      actorId: 'u1',
      actorEmail: 'admin@example.com',
      action: 'user.ban',
      targetType: 'user',
      targetId: 'u2',
      details: { reason: 'spam' },
    });
    const [row] = await testDb.db.select().from(auditLog);
    expect(row).toMatchObject({
      actorId: 'u1',
      actorEmail: 'admin@example.com',
      action: 'user.ban',
      targetType: 'user',
      targetId: 'u2',
      details: '{"reason":"spam"}',
    });
    expect(row?.createdAt).toBeInstanceOf(Date);
  });

  it('writeAudit throws when the write fails, recordAudit only logs', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    testDb.close(); // every statement fails from here on
    const entry = { action: 'message.delete' as const, targetType: 'message' as const };

    await expect(writeAudit(testDb.db, entry)).rejects.toThrow();
    await expect(recordAudit(testDb.db, entry)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      '[audit] could not record entry',
      'message.delete',
      expect.anything(),
    );
  });

  it('takes part in a transaction with the change it describes', async () => {
    await expect(
      testDb.db.transaction(async (tx) => {
        await writeAudit(tx, { action: 'message.status', targetId: 'm1' });
        throw new Error('the change failed');
      }),
    ).rejects.toThrow('the change failed');
    expect(await testDb.db.select().from(auditLog)).toHaveLength(0);
  });
});

describe('isLastActiveAdmin', () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>;
  beforeEach(async () => {
    testDb = await createTestDb();
  });
  afterEach(() => testDb.close());

  async function addUser(id: string, role: string | null, banned = false) {
    const now = new Date();
    await testDb.db.insert(user).values({
      id,
      name: id,
      email: `${id}@example.com`,
      emailVerified: true,
      role,
      banned,
      createdAt: now,
      updatedAt: now,
    });
  }

  it('is true only for an active admin with no other active admin', async () => {
    await addUser('alice', 'admin');
    await addUser('carol', 'administrator'); // not the admin role
    await addUser('dave', 'admin', true); // banned
    await addUser('erin', 'user');

    expect(await isLastActiveAdmin(testDb.db, 'alice')).toBe(true);
    expect(await isLastActiveAdmin(testDb.db, 'erin')).toBe(false);
    expect(await isLastActiveAdmin(testDb.db, 'dave')).toBe(false);
    expect(await isLastActiveAdmin(testDb.db, 'nobody')).toBe(false);

    await addUser('bob', 'user,admin');
    expect(await isLastActiveAdmin(testDb.db, 'alice')).toBe(false);
    expect(await isLastActiveAdmin(testDb.db, 'bob')).toBe(false);
  });
});

describe('guarded user operations', () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>;
  const alice = { id: 'alice', email: 'alice@example.com' };
  const bob = { id: 'bob', email: 'bob@example.com' };

  beforeEach(async () => {
    testDb = await createTestDb();
    await testDb.db.insert(user).values([
      { id: 'alice', name: 'Alice', email: 'alice@example.com', role: 'admin' },
      { id: 'bob', name: 'Bob', email: 'bob@example.com', role: 'user,admin' },
      { id: 'carol', name: 'Carol', email: 'carol@example.com', role: 'user' },
    ]);
    const now = new Date();
    const later = new Date(now.valueOf() + 3_600_000);
    await testDb.db.insert(session).values([
      { id: 's1', token: 't1', userId: 'bob', expiresAt: later, updatedAt: now },
      { id: 's2', token: 't2', userId: 'bob', expiresAt: later, updatedAt: now },
      { id: 's3', token: 't3', userId: 'alice', expiresAt: later, updatedAt: now },
    ]);
    await testDb.db.insert(account).values([
      {
        id: 'acc-bob',
        accountId: 'bob',
        providerId: 'credential',
        userId: 'bob',
        createdAt: now,
        updatedAt: now,
      },
    ]);
  });
  afterEach(() => testDb.close());

  async function roleOf(id: string) {
    const [row] = await testDb.db.select({ role: user.role }).from(user).where(eq(user.id, id));
    return row?.role;
  }

  it('demotes an administrator while another remains and logs it in the same transaction', async () => {
    await changeUserRole(testDb.db, alice, 'bob', 'user');

    expect(await roleOf('bob')).toBe('user');
    const [entry] = await testDb.db.select().from(auditLog);
    expect(entry).toMatchObject({
      actorId: 'alice',
      action: 'user.set_role',
      targetId: 'bob',
      details: '{"role":"user"}',
    });
  });

  it('refuses to demote, ban or delete the last active administrator and logs nothing', async () => {
    await changeUserRole(testDb.db, alice, 'bob', 'user');

    await expect(changeUserRole(testDb.db, bob, 'alice', 'user')).rejects.toBeInstanceOf(
      LastAdminError,
    );
    await expect(banUserAccount(testDb.db, bob, 'alice')).rejects.toBeInstanceOf(LastAdminError);
    await expect(deleteUserAccount(testDb.db, bob, 'alice')).rejects.toBeInstanceOf(LastAdminError);
    expect(await roleOf('alice')).toBe('admin');
    expect(await testDb.db.select().from(auditLog)).toHaveLength(1); // only the demotion
  });

  it('evaluates the guard inside the statement, so two demotions issued together leave one admin', async () => {
    // Statements on one connection execute back to back in arrival order; the second one
    // sees the first one's result. This is the property the old check-then-act code lacked:
    // both checks could pass before either change was made.
    const demote = (id: string) =>
      testDb.db
        .update(user)
        .set({ role: 'user' })
        .where(and(eq(user.id, id), notLastActiveAdmin(id)))
        .returning({ id: user.id });

    const [first, second] = await Promise.all([demote('bob'), demote('alice')]);

    expect(first.length + second.length).toBe(1);
    expect(await countActiveAdmins(testDb.db)).toBe(1);
  });

  it('promotes without consulting the guard', async () => {
    await changeUserRole(testDb.db, alice, 'carol', 'admin');
    expect(await roleOf('carol')).toBe('admin');
    expect(await countActiveAdmins(testDb.db)).toBe(3);
  });

  it('bans with a reason and signs the account out everywhere', async () => {
    await banUserAccount(testDb.db, alice, 'bob', 'spam');

    const [row] = await testDb.db.select().from(user).where(eq(user.id, 'bob'));
    expect(row).toMatchObject({ banned: true, banReason: 'spam', banExpires: null });
    expect(await testDb.db.select().from(session).where(eq(session.userId, 'bob'))).toHaveLength(0);
    expect(await testDb.db.select().from(session)).toHaveLength(1); // Alice keeps hers
    const [entry] = await testDb.db.select().from(auditLog);
    expect(entry).toMatchObject({ action: 'user.ban', details: '{"reason":"spam"}' });
  });

  it('deletes the account with its sessions and linked accounts', async () => {
    await deleteUserAccount(testDb.db, alice, 'bob');

    expect(await testDb.db.select().from(user).where(eq(user.id, 'bob'))).toHaveLength(0);
    expect(await testDb.db.select().from(session).where(eq(session.userId, 'bob'))).toHaveLength(0);
    expect(await testDb.db.select().from(account).where(eq(account.userId, 'bob'))).toHaveLength(0);
    const [entry] = await testDb.db.select().from(auditLog);
    expect(entry).toMatchObject({ action: 'user.delete', targetId: 'bob' });
  });

  it('reports unknown accounts', async () => {
    await expect(changeUserRole(testDb.db, alice, 'nobody', 'user')).rejects.toBeInstanceOf(
      UserNotFoundError,
    );
    await expect(deleteUserAccount(testDb.db, alice, 'nobody')).rejects.toBeInstanceOf(
      UserNotFoundError,
    );
  });
});
