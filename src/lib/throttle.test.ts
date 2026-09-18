import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestDb } from '../../tests/unit/db';

import { consumeThrottle, hashThrottleKey, pruneThrottle } from './throttle';

let testDb: Awaited<ReturnType<typeof createTestDb>>;

beforeEach(async () => {
  testDb = await createTestDb();
});
afterEach(() => testDb.close());

const rule = { limit: 2, windowMs: 60_000 };

describe('consumeThrottle', () => {
  it('allows requests up to the limit and blocks the rest', async () => {
    const now = new Date('2026-09-18T12:00:00Z');
    const first = await consumeThrottle(testDb.db, 'k', rule, now);
    const second = await consumeThrottle(testDb.db, 'k', rule, now);
    const third = await consumeThrottle(testDb.db, 'k', rule, now);

    expect(first).toMatchObject({ allowed: true, remaining: 1 });
    expect(second).toMatchObject({ allowed: true, remaining: 0 });
    expect(third).toMatchObject({ allowed: false, remaining: 0 });
    expect(third.resetAt.getTime()).toBe(now.getTime() + rule.windowMs);
  });

  it('starts a new window once the previous one expired', async () => {
    const start = new Date('2026-09-18T12:00:00Z');
    await consumeThrottle(testDb.db, 'k', rule, start);
    await consumeThrottle(testDb.db, 'k', rule, start);
    await consumeThrottle(testDb.db, 'k', rule, start);

    const later = new Date(start.getTime() + rule.windowMs);
    const result = await consumeThrottle(testDb.db, 'k', rule, later);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
    expect(result.resetAt.getTime()).toBe(later.getTime() + rule.windowMs);
  });

  it('keeps keys independent', async () => {
    const now = new Date();
    await consumeThrottle(testDb.db, 'a', rule, now);
    await consumeThrottle(testDb.db, 'a', rule, now);
    expect((await consumeThrottle(testDb.db, 'b', rule, now)).allowed).toBe(true);
  });

  it('prunes expired counters', async () => {
    const start = new Date('2026-09-18T12:00:00Z');
    await consumeThrottle(testDb.db, 'old', rule, start);
    await pruneThrottle(testDb.db, new Date(start.getTime() + rule.windowMs));
    // A fresh window starts at 1 again.
    expect((await consumeThrottle(testDb.db, 'old', rule, start)).remaining).toBe(1);
  });
});

describe('hashThrottleKey', () => {
  it('is deterministic and does not contain the input', async () => {
    const hash = await hashThrottleKey('203.0.113.7');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(await hashThrottleKey('203.0.113.7'));
    expect(hash).not.toContain('203.0.113.7');
  });
});
