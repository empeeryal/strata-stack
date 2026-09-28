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

async function addSubscriber(email: string, status: string, ageDays: number) {
  const at = now - ageDays * DAY;
  await client.execute({
    sql: 'INSERT INTO newsletter_subscriber (id, email, status, token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    args: [email, email, status, `token-${email}`, at, at],
  });
}

const options = { retentionDays: 365, maxAgeDays: null, newsletterRetentionDays: 7, now };

async function ids(): Promise<string[]> {
  const result = await client.execute('SELECT id FROM contact_message ORDER BY id');
  return result.rows.map((row) => String(row.id));
}

describe('pruneStaleData', () => {
  it('removes only archived messages past the retention period by default', async () => {
    await addMessage('old-archived', 'archived', 400);
    await addMessage('recent-archived', 'archived', 10);
    await addMessage('old-open', 'new', 400);

    const result = await pruneStaleData(client, options);

    expect(result).toEqual({
      archivedRemoved: 1,
      expiredRemoved: null,
      subscribersRemoved: 0,
      countersRemoved: 0,
    });
    expect(await ids()).toEqual(['old-open', 'recent-archived']);
  });

  it('enforces a maximum age for every status when configured', async () => {
    await addMessage('old-open', 'read', 800);
    await addMessage('young-open', 'new', 5);

    const result = await pruneStaleData(client, { ...options, maxAgeDays: 730 });

    expect(result.expiredRemoved).toBe(1);
    expect(await ids()).toEqual(['young-open']);
  });

  it('drops throttle counters whose window has ended', async () => {
    await client.execute({
      sql: 'INSERT INTO throttle (key, count, reset_at) VALUES (?, 1, ?), (?, 1, ?)',
      args: ['expired', now - 1, 'active', now + DAY],
    });

    const result = await pruneStaleData(client, options);

    expect(result.countersRemoved).toBe(1);
    const remaining = await client.execute('SELECT key FROM throttle');
    expect(remaining.rows.map((row) => row.key)).toEqual(['active']);
  });

  it('removes stale unconfirmed and unsubscribed newsletter addresses but never confirmed ones', async () => {
    await addSubscriber('old-pending@example.com', 'pending', 10);
    await addSubscriber('new-pending@example.com', 'pending', 2);
    await addSubscriber('old-gone@example.com', 'unsubscribed', 30);
    await addSubscriber('old-confirmed@example.com', 'confirmed', 400);

    const result = await pruneStaleData(client, options);

    expect(result.subscribersRemoved).toBe(2);
    const remaining = await client.execute(
      'SELECT email FROM newsletter_subscriber ORDER BY email',
    );
    expect(remaining.rows.map((row) => row.email)).toEqual([
      'new-pending@example.com',
      'old-confirmed@example.com',
    ]);
  });
});
