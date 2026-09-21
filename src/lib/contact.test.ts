import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { contactMessages } from '@/db/schema';

import { createTestDb } from '../../tests/unit/db';

import {
  CONTACT_LIMITS,
  ContactThrottledError,
  deliverContactMessage,
  submitContactMessage,
  type ContactDeps,
} from './contact';

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let sendEmail: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  testDb = await createTestDb();
  sendEmail = vi.fn().mockResolvedValue({ id: 'email-1' });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => testDb.close());

function deps(overrides: Partial<ContactDeps> = {}): ContactDeps {
  return {
    db: testDb.db,
    sendEmail: sendEmail as ContactDeps['sendEmail'],
    recipient: 'owner@example.com',
    siteName: 'Test Site',
    ...overrides,
  };
}

const input = {
  name: 'Jane Doe',
  email: 'Jane@Example.com',
  message: 'Hello there, I have a question about the template.',
};
const ctx = { ip: '203.0.113.7' };

describe('submitContactMessage', () => {
  it('stores the message and notifies the owner', async () => {
    const outcome = await submitContactMessage(input, ctx, deps());

    expect(outcome).toEqual({ delivery: 'sent' });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@example.com',
        replyTo: '"Jane Doe" <jane@example.com>',
        subject: expect.stringContaining('Jane'),
      }),
    );
    const rows = await testDb.db.select().from(contactMessages);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      email: 'jane@example.com',
      status: 'new',
      deliveryStatus: 'sent',
      deliveryAttempts: 1,
    });
    expect(rows[0]?.deliveredAt).toBeInstanceOf(Date);
  });

  it('answers a filled honeypot with success without storing or sending anything', async () => {
    const outcome = await submitContactMessage({ ...input, website: 'http://spam' }, ctx, deps());

    expect(outcome).toEqual({ delivery: 'ignored' });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(await testDb.db.select().from(contactMessages)).toHaveLength(0);
  });

  it('keeps the message when the notification fails and records the error', async () => {
    sendEmail.mockRejectedValueOnce(new Error('Resend is down'));

    const outcome = await submitContactMessage(input, ctx, deps());

    expect(outcome).toEqual({ delivery: 'failed' });
    const [row] = await testDb.db.select().from(contactMessages);
    expect(row).toMatchObject({
      deliveryStatus: 'failed',
      deliveryAttempts: 1,
      deliveryError: 'Resend is down',
    });
  });

  it('marks the notification as skipped when no recipient is configured', async () => {
    const outcome = await submitContactMessage(input, ctx, deps({ recipient: undefined }));

    expect(outcome).toEqual({ delivery: 'skipped' });
    expect(sendEmail).not.toHaveBeenCalled();
    const [row] = await testDb.db.select().from(contactMessages);
    expect(row?.deliveryStatus).toBe('skipped');
  });

  it('throttles repeated submissions from the same address', async () => {
    for (let i = 0; i < CONTACT_LIMITS.perEmail.limit; i += 1) {
      await submitContactMessage(input, { ip: `198.51.100.${i}` }, deps());
    }
    await expect(
      submitContactMessage(input, { ip: '198.51.100.99' }, deps()),
    ).rejects.toBeInstanceOf(ContactThrottledError);
    expect(await testDb.db.select().from(contactMessages)).toHaveLength(
      CONTACT_LIMITS.perEmail.limit,
    );
  });

  it('throttles repeated submissions from the same IP', async () => {
    for (let i = 0; i < CONTACT_LIMITS.perIp.limit; i += 1) {
      await submitContactMessage({ ...input, email: `sender${i}@example.com` }, ctx, deps());
    }
    await expect(
      submitContactMessage({ ...input, email: 'another@example.com' }, ctx, deps()),
    ).rejects.toBeInstanceOf(ContactThrottledError);
  });

  it('does not throttle by IP when the address is unknown', async () => {
    for (let i = 0; i < CONTACT_LIMITS.perIp.limit + 1; i += 1) {
      await submitContactMessage(
        { ...input, email: `sender${i}@example.com` },
        { ip: null },
        deps(),
      );
    }
    expect(await testDb.db.select().from(contactMessages)).toHaveLength(
      CONTACT_LIMITS.perIp.limit + 1,
    );
  });
});

describe('deliverContactMessage', () => {
  it('retries a failed notification and counts the attempt', async () => {
    sendEmail.mockRejectedValueOnce(new Error('temporary'));
    await submitContactMessage(input, ctx, deps());
    const [row] = await testDb.db.select().from(contactMessages);

    const delivery = await deliverContactMessage(row!.id, deps());

    expect(delivery).toBe('sent');
    const [updated] = await testDb.db.select().from(contactMessages);
    expect(updated).toMatchObject({
      deliveryStatus: 'sent',
      deliveryAttempts: 2,
      deliveryError: null,
    });
  });

  it('returns null for unknown ids', async () => {
    expect(await deliverContactMessage('missing', deps())).toBeNull();
  });
});
