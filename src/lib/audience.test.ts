import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const contacts = {
  create: vi.fn(),
  update: vi.fn(),
  segments: { add: vi.fn() },
};

vi.mock('resend', () => ({
  Resend: class {
    contacts = contacts;
    constructor(public apiKey: string) {}
  },
}));

import { createResendAudience, getNewsletterAudience } from './audience';

describe('createResendAudience', () => {
  beforeEach(() => {
    contacts.create.mockReset().mockResolvedValue({ data: { id: 'c1' }, error: null });
    contacts.update.mockReset().mockResolvedValue({ data: { id: 'c1' }, error: null });
    contacts.segments.add.mockReset().mockResolvedValue({ data: {}, error: null });
  });

  it('creates a subscribed contact in the segment', async () => {
    const audience = createResendAudience('re_key', 'seg_1');
    await audience.add('reader@example.com');
    expect(contacts.create).toHaveBeenCalledWith({
      email: 'reader@example.com',
      unsubscribed: false,
      segments: [{ id: 'seg_1' }],
    });
    expect(contacts.update).not.toHaveBeenCalled();
  });

  it('re-subscribes an existing contact and makes sure it is in the segment', async () => {
    contacts.create.mockResolvedValue({ data: null, error: { message: 'Contact already exists' } });
    const audience = createResendAudience('re_key', 'seg_1');
    await audience.add('reader@example.com');
    expect(contacts.update).toHaveBeenCalledWith({
      email: 'reader@example.com',
      unsubscribed: false,
    });
    expect(contacts.segments.add).toHaveBeenCalledWith({
      email: 'reader@example.com',
      segmentId: 'seg_1',
    });
  });

  it('surfaces provider errors from the fallback path', async () => {
    contacts.create.mockResolvedValue({ data: null, error: { message: 'exists' } });
    contacts.update.mockResolvedValue({ data: null, error: { message: 'Update failed' } });
    await expect(createResendAudience('re_key', 'seg_1').add('a@example.com')).rejects.toThrow(
      'Update failed',
    );
    contacts.update.mockResolvedValue({ data: {}, error: null });
    contacts.segments.add.mockResolvedValue({ data: null, error: { message: 'No such segment' } });
    await expect(createResendAudience('re_key', 'seg_1').add('a@example.com')).rejects.toThrow(
      'No such segment',
    );
  });

  it('marks a contact unsubscribed instead of deleting it', async () => {
    const audience = createResendAudience('re_key', 'seg_1');
    await audience.remove('reader@example.com');
    expect(contacts.update).toHaveBeenCalledWith({
      email: 'reader@example.com',
      unsubscribed: true,
    });
    contacts.update.mockResolvedValue({ data: null, error: { message: 'Not found' } });
    await expect(audience.remove('reader@example.com')).rejects.toThrow('Not found');
  });
});

describe('getNewsletterAudience', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is off unless both the API key and the segment are configured', () => {
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('RESEND_AUDIENCE_ID', 'seg_1');
    expect(getNewsletterAudience()).toBeNull();
    vi.stubEnv('RESEND_API_KEY', 're_key');
    vi.stubEnv('RESEND_AUDIENCE_ID', '');
    expect(getNewsletterAudience()).toBeNull();
    vi.stubEnv('RESEND_AUDIENCE_ID', 'seg_1');
    expect(getNewsletterAudience()).not.toBeNull();
  });
});
