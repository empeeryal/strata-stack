import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { pruneStaleData } from './retention';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 8, 18);

let client: Client;

beforeEach(async () => {
  client = createClient({ url: ':memory:' });
  await migrate(drizzle(client), {
    migrationsFolder: new URL('../../drizzle', import.meta.url).pathname,
  });
});
afterEach(() => client.close());

async function addMessage(id: string, status: string, ageDays: number) {
  const createdAt = now - ageDays * DAY;
  await client.execute({
    sql: 'INSERT INTO contact_message (id, name, email, message, status, archived_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [
      id,
      'Sender',
      'sender@example.com',
      'Hi',
      status,
      status === 'archived' ? createdAt : null,
      createdAt,
    ],
  });
}

async function ids(): Promise<string[]> {
  const result = await client.execute('SELECT id FROM contact_message ORDER BY id');
  return result.rows.map((row) => String(row.id));
}

describe('pruneStaleData', () => {
  it('removes only archived messages past the retention period by default', async () => {
    await addMessage('old-archived', 'archived', 400);
    await addMessage('recent-archived', 'archived', 10);
    await addMessage('old-open', 'new', 400);

    const result = await pruneStaleData(client, { retentionDays: 365, maxAgeDays: null, now });

    expect(result).toEqual({ archivedRemoved: 1, expiredRemoved: null, countersRemoved: 0 });
    expect(await ids()).toEqual(['old-open', 'recent-archived']);
  });

  it('enforces a maximum age for every status when configured', async () => {
    await addMessage('old-open', 'read', 800);
    await addMessage('young-open', 'new', 5);

    const result = await pruneStaleData(client, { retentionDays: 365, maxAgeDays: 730, now });

    expect(result.expiredRemoved).toBe(1);
    expect(await ids()).toEqual(['young-open']);
  });

  it('drops throttle counters whose window has ended', async () => {
    await client.execute({
      sql: 'INSERT INTO throttle (key, count, reset_at) VALUES (?, 1, ?), (?, 1, ?)',
      args: ['expired', now - 1, 'active', now + DAY],
    });

    const result = await pruneStaleData(client, { retentionDays: 365, maxAgeDays: null, now });

    expect(result.countersRemoved).toBe(1);
    const remaining = await client.execute('SELECT key FROM throttle');
    expect(remaining.rows.map((row) => row.key)).toEqual(['active']);
  });
});
