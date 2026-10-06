import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { auditLog, newsletterSubscribers } from '@/db/schema';

import { createTestDb } from '../../tests/unit/db';

import type { EmailMessage } from './email';
import {
  applyProviderContactEvent,
  CONFIRMATION_TTL_MS,
  confirmSubscription,
  generateToken,
  isTokenShape,
  NEWSLETTER_LIMITS,
  NewsletterEmailError,
  NewsletterThrottledError,
  removeSubscriber,
  SubscriberNotFoundError,
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
  type NewsletterDeps,
} from './newsletter';

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let sendEmail: ReturnType<typeof vi.fn>;
type AudienceCall = (email: string) => Promise<void>;
let audience: {
  add: ReturnType<typeof vi.fn<AudienceCall>>;
  remove: ReturnType<typeof vi.fn<AudienceCall>>;
};

beforeEach(async () => {
  testDb = await createTestDb();
  sendEmail = vi.fn().mockResolvedValue({ id: 'email-1' });
  audience = {
    add: vi.fn<AudienceCall>().mockResolvedValue(undefined),
    remove: vi.fn<AudienceCall>().mockResolvedValue(undefined),
  };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => testDb.close());

function deps(overrides: Partial<NewsletterDeps> = {}): NewsletterDeps {
  return {
    db: testDb.db,
    sendEmail: sendEmail as NewsletterDeps['sendEmail'],
    siteName: 'Test Site',
    siteUrl: 'https://example.com',
    audience,
    ...overrides,
  };
}

const ctx = { ip: '203.0.113.7' };

/** The link in the n-th email sent so far. */
function linkInEmail(index = 0): URL {
  const message = sendEmail.mock.calls[index]?.[0] as EmailMessage | undefined;
  const match = message?.text.match(/https:\/\/\S+/);
  if (!match) throw new Error(`no link in email ${index}`);
  return new URL(match[0]);
}

async function rows() {
  return testDb.db.select().from(newsletterSubscribers);
}

async function subscribeAndConfirm(email: string) {
  await subscribeToNewsletter({ email }, ctx, deps());
  const token = linkInEmail(sendEmail.mock.calls.length - 1).searchParams.get('token') ?? '';
  await confirmSubscription(token, deps());
  return token;
}

describe('generateToken', () => {
  it('produces distinct URL-safe tokens of the expected shape', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(isTokenShape(a)).toBe(true);
    expect(isTokenShape('short')).toBe(false);
    expect(isTokenShape(`${a}=`)).toBe(false);
  });
});

describe('subscribeToNewsletter', () => {
  it('stores a pending address and emails a confirmation link carrying its token', async () => {
    const outcome = await subscribeToNewsletter(
      { email: 'Reader@Example.com', source: 'footer' },
      ctx,
      deps(),
    );

    expect(outcome).toBe('confirmation-sent');
    const [row] = await rows();
    expect(row).toMatchObject({ email: 'reader@example.com', status: 'pending', source: 'footer' });
    expect(row?.confirmationSentAt).toBeInstanceOf(Date);
    expect(row?.confirmedAt).toBeNull();

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'reader@example.com',
        subject: expect.stringMatching(/Confirm/),
      }),
    );
    const link = linkInEmail();
    expect(link.origin + link.pathname).toBe('https://example.com/newsletter/confirm');
    expect(link.searchParams.get('token')).toBe(row?.token);
  });

  it('answers a filled honeypot without storing or sending anything', async () => {
    const outcome = await subscribeToNewsletter(
      { email: 'bot@example.com', website: 'http://spam' },
      ctx,
      deps(),
    );

    expect(outcome).toBe('ignored');
    expect(sendEmail).not.toHaveBeenCalled();
    expect(await rows()).toHaveLength(0);
  });

  it('gives a pending address a new token and invalidates the earlier link', async () => {
    await subscribeToNewsletter({ email: 'reader@example.com' }, ctx, deps());
    const first = linkInEmail(0).searchParams.get('token') ?? '';
    await subscribeToNewsletter({ email: 'reader@example.com' }, ctx, deps());
    const second = linkInEmail(1).searchParams.get('token') ?? '';

    expect(second).not.toBe(first);
    expect(await rows()).toHaveLength(1);
    expect(await confirmSubscription(first, deps())).toBe('invalid');
    expect(await confirmSubscription(second, deps())).toBe('confirmed');
  });

  it('tells a confirmed address it is already subscribed and sends the unsubscribe link', async () => {
    const token = await subscribeAndConfirm('reader@example.com');
    sendEmail.mockClear();

    const outcome = await subscribeToNewsletter({ email: 'reader@example.com' }, ctx, deps());

    expect(outcome).toBe('already-subscribed');
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringMatching(/already subscribed/) }),
    );
    const link = linkInEmail();
    expect(link.pathname).toBe('/newsletter/unsubscribe');
    expect(link.searchParams.get('token')).toBe(token);
    const [row] = await rows();
    expect(row).toMatchObject({ status: 'confirmed', token });
  });

  it('starts over for an address that unsubscribed', async () => {
    const token = await subscribeAndConfirm('reader@example.com');
    await unsubscribeFromNewsletter(token, deps());

    const outcome = await subscribeToNewsletter({ email: 'reader@example.com' }, ctx, deps());

    expect(outcome).toBe('confirmation-sent');
    const [row] = await rows();
    expect(row).toMatchObject({ status: 'pending', unsubscribedAt: null });
    expect(row?.token).not.toBe(token);
  });

  it('starts a re-subscribing address with a clean provider record', async () => {
    const token = await subscribeAndConfirm('reader@example.com');
    audience.remove.mockRejectedValueOnce(new Error('Resend is down'));
    await unsubscribeFromNewsletter(token, deps());
    expect((await rows())[0]?.audienceError).toBe('Resend is down');

    await subscribeToNewsletter({ email: 'reader@example.com' }, ctx, deps());
    const [row] = await rows();
    expect(row).toMatchObject({ status: 'pending', audienceError: null, audienceSyncedAt: null });
  });

  it('retries a failed audience add when a confirmed address asks again', async () => {
    audience.add.mockRejectedValueOnce(new Error('audience unavailable'));
    await subscribeAndConfirm('reader@example.com');
    expect((await rows())[0]?.audienceError).toBe('audience unavailable');

    expect(await subscribeToNewsletter({ email: 'reader@example.com' }, ctx, deps())).toBe(
      'already-subscribed',
    );
    expect(audience.add).toHaveBeenCalledTimes(2);
    const [row] = await rows();
    expect(row?.audienceError).toBeNull();
    expect(row?.audienceSyncedAt).toBeInstanceOf(Date);
  });

  it('caps the confirmation emails the site sends in an hour, whoever asks', async () => {
    const { limit } = NEWSLETTER_LIMITS.site;
    for (let i = 0; i < limit; i += 1) {
      await subscribeToNewsletter(
        { email: `reader-${i}@example.com` },
        { ip: `203.0.113.${i % 250}` },
        deps(),
      );
    }
    await expect(
      subscribeToNewsletter({ email: 'one-more@example.com' }, { ip: '198.51.100.1' }, deps()),
    ).rejects.toBeInstanceOf(NewsletterThrottledError);
    expect(sendEmail).toHaveBeenCalledTimes(limit);
  });

  it('throttles repeated requests for one address', async () => {
    for (let i = 0; i < NEWSLETTER_LIMITS.perEmail.limit; i += 1) {
      await subscribeToNewsletter({ email: 'reader@example.com' }, { ip: null }, deps());
    }

    await expect(
      subscribeToNewsletter({ email: 'reader@example.com' }, { ip: null }, deps()),
    ).rejects.toBeInstanceOf(NewsletterThrottledError);
    expect(sendEmail).toHaveBeenCalledTimes(NEWSLETTER_LIMITS.perEmail.limit);
  });

  it('throttles one address that asks for many subscriptions', async () => {
    for (let i = 0; i < NEWSLETTER_LIMITS.perIp.limit; i += 1) {
      await subscribeToNewsletter({ email: `reader-${i}@example.com` }, ctx, deps());
    }

    await expect(
      subscribeToNewsletter({ email: 'one-more@example.com' }, ctx, deps()),
    ).rejects.toBeInstanceOf(NewsletterThrottledError);
    // Another address is not affected.
    await expect(
      subscribeToNewsletter({ email: 'one-more@example.com' }, { ip: '203.0.113.8' }, deps()),
    ).resolves.toBe('confirmation-sent');
  });

  it('keeps one row when two first-time requests for an address arrive together', async () => {
    // Both requests pass the "does it exist?" lookup before either has inserted; the second
    // insert lands on the unique index and takes the pending row over instead of failing.
    const outcomes = await Promise.all([
      subscribeToNewsletter({ email: 'reader@example.com' }, ctx, deps()),
      subscribeToNewsletter({ email: 'reader@example.com' }, ctx, deps()),
    ]);

    expect(outcomes).toEqual(['confirmation-sent', 'confirmation-sent']);
    const stored = await rows();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ email: 'reader@example.com', status: 'pending' });
    // Exactly one of the two links works: the one carrying the token that was stored last.
    const tokens = [linkInEmail(0), linkInEmail(1)].map((url) => url.searchParams.get('token'));
    expect(tokens).toContain(stored[0]?.token);
    expect(await confirmSubscription(stored[0]?.token ?? '', deps())).toBe('confirmed');
  });

  it('keeps the request and reports when the confirmation cannot be sent', async () => {
    sendEmail.mockRejectedValueOnce(new Error('Resend is down'));

    await expect(
      subscribeToNewsletter({ email: 'reader@example.com' }, ctx, deps()),
    ).rejects.toBeInstanceOf(NewsletterEmailError);
    const [row] = await rows();
    expect(row).toMatchObject({ email: 'reader@example.com', status: 'pending' });
  });
});

describe('confirmSubscription', () => {
  it('confirms the address and mirrors it to the audience', async () => {
    await subscribeToNewsletter({ email: 'reader@example.com' }, ctx, deps());
    const token = linkInEmail().searchParams.get('token') ?? '';

    expect(await confirmSubscription(token, deps())).toBe('confirmed');
    const [row] = await rows();
    expect(row?.status).toBe('confirmed');
    expect(row?.confirmedAt).toBeInstanceOf(Date);
    expect(row?.audienceSyncedAt).toBeInstanceOf(Date);
    expect(row?.audienceError).toBeNull();
    expect(audience.add).toHaveBeenCalledWith('reader@example.com');

    expect(await confirmSubscription(token, deps())).toBe('already-confirmed');
    expect(audience.add).toHaveBeenCalledTimes(1);
  });

  it('rejects a confirmation link older than the confirmation window', async () => {
    const requested = new Date('2026-01-01T10:00:00Z');
    await subscribeToNewsletter(
      { email: 'reader@example.com' },
      ctx,
      deps({ now: () => requested }),
    );
    const token = linkInEmail().searchParams.get('token') ?? '';
    const late = new Date(requested.valueOf() + CONFIRMATION_TTL_MS + 1);

    expect(await confirmSubscription(token, deps({ now: () => late }))).toBe('invalid');
    expect((await rows())[0]?.status).toBe('pending');
    expect(audience.add).not.toHaveBeenCalled();

    // Asking again issues a fresh link that works.
    await subscribeToNewsletter({ email: 'reader@example.com' }, ctx, deps({ now: () => late }));
    const fresh = linkInEmail(1).searchParams.get('token') ?? '';
    expect(await confirmSubscription(fresh, deps({ now: () => late }))).toBe('confirmed');
  });

  it('rejects malformed and unknown tokens', async () => {
    expect(await confirmSubscription('nope', deps())).toBe('invalid');
    expect(await confirmSubscription(generateToken(), deps())).toBe('invalid');
    expect(audience.add).not.toHaveBeenCalled();
  });

  it('records an audience failure on the row without failing the confirmation', async () => {
    audience.add.mockRejectedValueOnce(new Error('audience unavailable'));
    await subscribeToNewsletter({ email: 'reader@example.com' }, ctx, deps());
    const token = linkInEmail().searchParams.get('token') ?? '';

    expect(await confirmSubscription(token, deps())).toBe('confirmed');
    const [row] = await rows();
    expect(row).toMatchObject({ status: 'confirmed', audienceError: 'audience unavailable' });
    expect(row?.audienceSyncedAt).toBeNull();
  });

  it('works without an audience', async () => {
    await subscribeToNewsletter({ email: 'reader@example.com' }, ctx, deps({ audience: null }));
    const token = linkInEmail().searchParams.get('token') ?? '';

    expect(await confirmSubscription(token, deps({ audience: null }))).toBe('confirmed');
    const [row] = await rows();
    expect(row?.audienceSyncedAt).toBeNull();
  });
});

describe('unsubscribeFromNewsletter', () => {
  it('ends a confirmed subscription, updates the audience and retires the token', async () => {
    const token = await subscribeAndConfirm('reader@example.com');

    expect(await unsubscribeFromNewsletter(token, deps())).toBe('unsubscribed');
    const [row] = await testDb.db
      .select()
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.email, 'reader@example.com'));
    expect(row?.status).toBe('unsubscribed');
    expect(row?.unsubscribedAt).toBeInstanceOf(Date);
    expect(audience.remove).toHaveBeenCalledWith('reader@example.com');

    expect(await unsubscribeFromNewsletter(token, deps())).toBe('already-unsubscribed');
    expect(await confirmSubscription(token, deps())).toBe('invalid');
    expect(audience.remove).toHaveBeenCalledTimes(1);
  });

  it('lets a pending address opt out without touching the audience', async () => {
    await subscribeToNewsletter({ email: 'reader@example.com' }, ctx, deps());
    const token = linkInEmail().searchParams.get('token') ?? '';

    expect(await unsubscribeFromNewsletter(token, deps())).toBe('unsubscribed');
    expect(audience.remove).not.toHaveBeenCalled();
  });

  it('reports unknown tokens', async () => {
    expect(await unsubscribeFromNewsletter(generateToken(), deps())).toBe('invalid');
  });
});

describe('applyProviderContactEvent', () => {
  const event = (
    type: string,
    unsubscribed?: boolean,
    email = 'Reader@example.com',
    createdAt = new Date().toISOString(),
  ) => ({
    type,
    created_at: createdAt,
    data: { id: 'c_1', email, ...(unsubscribed === undefined ? {} : { unsubscribed }) },
  });

  it('ignores a retried opt-out that predates the current confirmation', async () => {
    await subscribeAndConfirm('reader@example.com');
    const stale = event('contact.updated', true, 'reader@example.com', '2026-01-01T00:00:00.000Z');

    expect(await applyProviderContactEvent(stale, deps())).toBe('ignored');
    expect((await rows())[0]?.status).toBe('confirmed');
    expect(await testDb.db.select().from(auditLog)).toHaveLength(0);

    // Without a usable time the event is applied, as before.
    const undated = { ...event('contact.updated', true), created_at: 'yesterday' };
    expect(await applyProviderContactEvent(undated, deps())).toBe('unsubscribed');
  });

  it('marks a confirmed address unsubscribed when the provider says so, once', async () => {
    await subscribeAndConfirm('reader@example.com');

    expect(await applyProviderContactEvent(event('contact.updated', true), deps())).toBe(
      'unsubscribed',
    );
    const [row] = await rows();
    expect(row?.status).toBe('unsubscribed');
    expect(row?.unsubscribedAt).toBeInstanceOf(Date);
    expect(row?.audienceError).toBeNull();
    // The provider made the change; nothing is pushed back to it.
    expect(audience.remove).not.toHaveBeenCalled();
    const entries = await testDb.db.select().from(auditLog);
    expect(entries.map((entry) => entry.action)).toEqual(['subscriber.unsubscribe']);
    expect(entries[0]?.targetId).toBe(row?.id);

    expect(await applyProviderContactEvent(event('contact.updated', true), deps())).toBe('ignored');
    expect(await testDb.db.select().from(auditLog)).toHaveLength(1);
  });

  it('treats a deleted contact as an opt-out', async () => {
    await subscribeAndConfirm('reader@example.com');
    expect(await applyProviderContactEvent(event('contact.deleted'), deps())).toBe('unsubscribed');
    expect((await rows())[0]?.status).toBe('unsubscribed');
  });

  it('never re-subscribes from the provider side', async () => {
    const token = await subscribeAndConfirm('reader@example.com');
    await unsubscribeFromNewsletter(token, deps());

    expect(await applyProviderContactEvent(event('contact.updated', false), deps())).toBe(
      'ignored',
    );
    expect((await rows())[0]?.status).toBe('unsubscribed');
  });

  it('ignores other events, unknown addresses and malformed payloads', async () => {
    await subscribeAndConfirm('reader@example.com');
    expect(await applyProviderContactEvent(event('contact.created', false), deps())).toBe(
      'ignored',
    );
    expect(await applyProviderContactEvent(event('email.sent'), deps())).toBe('ignored');
    expect(
      await applyProviderContactEvent(event('contact.updated', true, 'nobody@example.com'), deps()),
    ).toBe('unknown-address');
    expect(await applyProviderContactEvent(null, deps())).toBe('ignored');
    expect(await applyProviderContactEvent({ type: 'contact.updated' }, deps())).toBe('ignored');
    expect((await rows())[0]?.status).toBe('confirmed');
  });
});

describe('removeSubscriber', () => {
  const actor = { id: 'admin-1', email: 'admin@example.com' };

  async function auditEntries() {
    return testDb.db.select().from(auditLog);
  }

  it('removes a confirmed address from the audience and the table, and logs it', async () => {
    await subscribeAndConfirm('reader@example.com');
    const [row] = await rows();

    expect(await removeSubscriber(row?.id ?? '', actor, deps())).toBe('removed');
    expect(await rows()).toHaveLength(0);
    expect(audience.remove).toHaveBeenCalledWith('reader@example.com');
    const [entry] = await auditEntries();
    expect(entry).toMatchObject({
      actorId: 'admin-1',
      action: 'subscriber.delete',
      targetType: 'subscriber',
      targetId: row?.id,
      details: '{"status":"confirmed","provider":"removed"}',
    });
  });

  it('keeps the row as an opt-out with the error when the audience refuses, and says so', async () => {
    await subscribeAndConfirm('reader@example.com');
    const [row] = await rows();
    audience.remove.mockRejectedValueOnce(new Error('Resend is down'));

    expect(await removeSubscriber(row?.id ?? '', actor, deps())).toBe('removed-unsynced');
    // Deleting it would leave nothing that says which contact the provider still sends to; the
    // retention job retries from this state and deletes the row once the provider has taken it.
    const [kept] = await rows();
    expect(kept).toMatchObject({
      email: 'reader@example.com',
      status: 'unsubscribed',
      audienceError: 'Resend is down',
      audienceSyncedAt: null,
    });
    expect(kept?.unsubscribedAt).not.toBeNull();
    const [entry] = await auditEntries();
    expect(entry?.details).toBe('{"status":"confirmed","provider":"failed","kept":true}');

    // Removing it again retries the provider; when that works the row goes.
    expect(await removeSubscriber(row?.id ?? '', actor, deps())).toBe('removed');
    expect(await rows()).toHaveLength(0);
  });

  it('tells the provider about an opt-out it never received before deleting the row', async () => {
    const token = await subscribeAndConfirm('reader@example.com');
    audience.remove.mockRejectedValueOnce(new Error('Resend is down'));
    await unsubscribeFromNewsletter(token, deps());
    const [row] = await rows();
    expect(row).toMatchObject({ status: 'unsubscribed', audienceError: 'Resend is down' });

    expect(await removeSubscriber(row?.id ?? '', actor, deps())).toBe('removed');
    expect(audience.remove).toHaveBeenCalledTimes(2);
    const [entry] = await auditEntries();
    expect(entry?.details).toBe('{"status":"unsubscribed","provider":"removed"}');
  });

  it('leaves the audience alone for an address that never confirmed', async () => {
    await subscribeToNewsletter({ email: 'reader@example.com' }, ctx, deps());
    const [row] = await rows();

    expect(await removeSubscriber(row?.id ?? '', actor, deps())).toBe('removed');
    expect(audience.remove).not.toHaveBeenCalled();
    const [entry] = await auditEntries();
    expect(entry?.details).toBe('{"status":"pending","provider":"skipped"}');
  });

  it('reports unknown ids without logging anything', async () => {
    await expect(removeSubscriber('nope', actor, deps())).rejects.toBeInstanceOf(
      SubscriberNotFoundError,
    );
    expect(await auditEntries()).toHaveLength(0);
  });
});
