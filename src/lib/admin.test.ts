import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { auditLog } from '@/db/schema';

import { createTestDb } from '../../tests/unit/db';

import { hasRole, isAdmin, recordAudit, rolesOf } from './admin';

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

describe('recordAudit', () => {
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
});
