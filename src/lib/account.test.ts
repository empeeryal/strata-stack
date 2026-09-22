import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { auditLog, session, user } from '@/db/schema';

import { createTestDb } from '../../tests/unit/db';

import { describeUserAgent, revokeOwnSession, SessionRevokeError } from './account';

describe('describeUserAgent', () => {
  it('names the browser and the system', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
      ),
    ).toBe('Chrome on macOS');
    expect(
      describeUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari on iOS');
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
      ),
    ).toBe('Edge on Windows');
    expect(
      describeUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0'),
    ).toBe('Firefox on Linux');
  });

  it('falls back gracefully', () => {
    expect(describeUserAgent('curl/8.6.0')).toBe('Unknown device');
    expect(describeUserAgent(null)).toBe('Unknown device');
    expect(describeUserAgent('Something Windows-ish')).toBe('Windows');
  });
});

describe('revokeOwnSession', () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>;
  const alice = { id: 'alice', email: 'alice@example.com' };

  beforeEach(async () => {
    testDb = await createTestDb();
    await testDb.db.insert(user).values([
      { id: 'alice', name: 'Alice', email: 'alice@example.com' },
      { id: 'bob', name: 'Bob', email: 'bob@example.com' },
    ]);
    const now = new Date();
    const later = new Date(now.valueOf() + 3_600_000);
    await testDb.db.insert(session).values([
      { id: 'current', token: 't1', userId: 'alice', expiresAt: later, updatedAt: now },
      { id: 'phone', token: 't2', userId: 'alice', expiresAt: later, updatedAt: now },
      { id: 'bobs', token: 't3', userId: 'bob', expiresAt: later, updatedAt: now },
    ]);
  });
  afterEach(() => testDb.close());

  it('deletes another session of the same user and logs it', async () => {
    await revokeOwnSession(testDb.db, alice, 'current', 'phone');

    expect(await testDb.db.select().from(session).where(eq(session.id, 'phone'))).toHaveLength(0);
    expect(await testDb.db.select().from(session).where(eq(session.id, 'current'))).toHaveLength(1);
    const [entry] = await testDb.db.select().from(auditLog);
    expect(entry).toMatchObject({
      actorId: 'alice',
      action: 'session.revoke',
      targetType: 'session',
      targetId: 'phone',
    });
  });

  it('refuses the current session and sessions of other users', async () => {
    await expect(revokeOwnSession(testDb.db, alice, 'current', 'current')).rejects.toBeInstanceOf(
      SessionRevokeError,
    );
    await expect(revokeOwnSession(testDb.db, alice, 'current', 'bobs')).rejects.toBeInstanceOf(
      SessionRevokeError,
    );
    expect(await testDb.db.select().from(session)).toHaveLength(3);
    expect(await testDb.db.select().from(auditLog)).toHaveLength(0);
  });
});
