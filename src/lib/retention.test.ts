import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

async function addSubscriber(
  email: string,
  status: string,
  ageDays: number,
  audienceError: string | null = null,
) {
  const at = now - ageDays * DAY;
  await client.execute({
    sql: 'INSERT INTO newsletter_subscriber (id, email, status, token, created_at, updated_at, audience_error) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [email, email, status, `token-${email}`, at, at, audienceError],
  });
}

async function subscriberEmails(): Promise<string[]> {
  const result = await client.execute('SELECT email FROM newsletter_subscriber ORDER BY email');
  return result.rows.map((row) => String(row.email));
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
      sessionsRemoved: 0,
      audienceSynced: 0,
      audienceFailed: 0,
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

  it('deletes sessions that have expired and keeps live ones', async () => {
    await client.execute({
      sql: 'INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)',
      args: ['u1', 'Ada', 'ada@example.com', now, now],
    });
    await client.execute({
      sql: 'INSERT INTO session (id, token, user_id, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)',
      args: [
        'gone',
        't1',
        'u1',
        now - 1,
        now - 8 * DAY,
        now - 8 * DAY,
        'live',
        't2',
        'u1',
        now + DAY,
        now,
        now,
      ],
    });

    const result = await pruneStaleData(client, options);

    expect(result.sessionsRemoved).toBe(1);
    const remaining = await client.execute('SELECT id FROM session');
    expect(remaining.rows.map((row) => row.id)).toEqual(['live']);
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
    expect(await subscriberEmails()).toEqual([
      'new-pending@example.com',
      'old-confirmed@example.com',
    ]);
  });

  it('retries failed audience syncs first and keeps an opt-out the provider has not received', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await addSubscriber('told-now@example.com', 'unsubscribed', 30, 'Resend was down');
    await addSubscriber('still-failing@example.com', 'unsubscribed', 30, 'Resend was down');
    await addSubscriber('missing@example.com', 'confirmed', 400, 'Resend was down');
    await addSubscriber('old-gone@example.com', 'unsubscribed', 30);
    const audience = {
      add: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn(async (email: string) => {
        if (email === 'still-failing@example.com') throw new Error('Still down');
      }),
    };

    const result = await pruneStaleData(client, { ...options, audience });

    expect(audience.add).toHaveBeenCalledWith('missing@example.com');
    expect(audience.remove).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ audienceSynced: 2, audienceFailed: 1, subscribersRemoved: 2 });
    // The opt-out the provider now knows about is gone with the other stale row; the one it
    // still refuses stays, with the fresh error, and the confirmed row is marked synced.
    expect(await subscriberEmails()).toEqual(['missing@example.com', 'still-failing@example.com']);
    const rows = await client.execute(
      'SELECT email, audience_error, audience_synced_at FROM newsletter_subscriber ORDER BY email',
    );
    expect(rows.rows.map((row) => [row.audience_error, row.audience_synced_at !== null])).toEqual([
      [null, true],
      ['Still down', false],
    ]);
  });

  it('keeps undelivered opt-outs when no audience is configured to retry them', async () => {
    await addSubscriber('untold@example.com', 'unsubscribed', 30, 'Resend was down');
    await addSubscriber('old-gone@example.com', 'unsubscribed', 30);

    const result = await pruneStaleData(client, options);

    expect(result).toMatchObject({ audienceSynced: 0, audienceFailed: 1, subscribersRemoved: 1 });
    expect(await subscriberEmails()).toEqual(['untold@example.com']);
  });
});
