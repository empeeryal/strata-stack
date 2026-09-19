import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { auditLog, user } from '@/db/schema';

import { createTestDb } from '../../tests/unit/db';

import {
  countActiveAdmins,
  hasRole,
  isAdmin,
  isLastActiveAdmin,
  recordAudit,
  rolesOf,
  writeAudit,
} from './admin';

describe('roles', () => {
  it('parses comma-separated roles', () => {
    expect(rolesOf({ role: 'admin,editor' })).toEqual(['admin', 'editor']);
    expect(rolesOf({ role: ' user ' })).toEqual(['user']);
    expect(rolesOf({ role: null })).toEqual([]);
    expect(rolesOf(undefined)).toEqual([]);
  });

  it('recognises administrators', () => {
    expect(isAdmin({ role: 'admin' })).toBe(true);
    expect(isAdmin({ role: 'user,admin' })).toBe(true);
    expect(isAdmin({ role: 'user' })).toBe(false);
    expect(isAdmin({ role: 'administrator' })).toBe(false);
    expect(isAdmin(null)).toBe(false);
    expect(hasRole({ role: 'editor' }, 'editor')).toBe(true);
  });
});

describe('audit log', () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>;
  beforeEach(async () => {
    testDb = await createTestDb();
  });
  afterEach(() => {
    testDb.close();
    vi.restoreAllMocks();
  });

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

describe('last administrator protection', () => {
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

  it('counts only unbanned accounts whose roles include admin', async () => {
    await addUser('alice', 'admin');
    await addUser('bob', 'user,admin');
    await addUser('carol', 'administrator'); // not the admin role
    await addUser('dave', 'admin', true); // banned
    await addUser('erin', 'user');

    expect(await countActiveAdmins(testDb.db)).toBe(2);
    expect(await countActiveAdmins(testDb.db, { excludeUserId: 'alice' })).toBe(1);
  });

  it('identifies the last active administrator', async () => {
    await addUser('alice', 'admin');
    await addUser('dave', 'admin', true);
    await addUser('erin', 'user');

    expect(await isLastActiveAdmin(testDb.db, 'alice')).toBe(true);
    expect(await isLastActiveAdmin(testDb.db, 'erin')).toBe(false);
    expect(await isLastActiveAdmin(testDb.db, 'dave')).toBe(false);
    expect(await isLastActiveAdmin(testDb.db, 'nobody')).toBe(false);

    await addUser('bob', 'admin');
    expect(await isLastActiveAdmin(testDb.db, 'alice')).toBe(false);
  });
});
