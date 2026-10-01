import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.fn();
vi.mock('resend', () => ({
  Resend: class {
    emails = { send };
    constructor(public apiKey: string) {}
  },
}));

import { formatAddress, isEmailConfigured, sendEmail } from './email';

describe('formatAddress', () => {
  it('quotes the display name', () => {
    expect(formatAddress('Jane Doe', 'jane@example.com')).toBe('"Jane Doe" <jane@example.com>');
  });

  it('drops characters that would break the header', () => {
    expect(formatAddress('Jane "J" <Doe>\r\nBcc: x', 'jane@example.com')).toBe(
      '"Jane J DoeBcc: x" <jane@example.com>',
    );
  });

  it('returns the bare address without a usable name', () => {
    expect(formatAddress('  ', 'jane@example.com')).toBe('jane@example.com');
    expect(formatAddress('"<>"', 'jane@example.com')).toBe('jane@example.com');
  });
});

describe('sendEmail', () => {
  const message = { to: 'reader@example.com', subject: 'Hello', text: 'Hi there' };

  beforeEach(() => {
    send.mockReset().mockResolvedValue({ data: { id: 'email_1' }, error: null });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('prints the message instead of sending it when no provider is configured', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    expect(isEmailConfigured()).toBe(false);

    await expect(sendEmail({ ...message, replyTo: 'someone@example.com' })).resolves.toEqual({
      id: 'logged',
    });
    expect(info).toHaveBeenCalledOnce();
    expect(info.mock.calls[0]?.[0]).toContain('reply-to: someone@example.com');
    expect(send).not.toHaveBeenCalled();
  });

  it('sends through Resend with the configured sender and optional fields', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('EMAIL_FROM', 'Site <noreply@example.com>');
    expect(isEmailConfigured()).toBe(true);

    await expect(sendEmail({ ...message, html: '<p>Hi</p>' })).resolves.toEqual({ id: 'email_1' });
    expect(send).toHaveBeenCalledWith({
      from: 'Site <noreply@example.com>',
      to: 'reader@example.com',
      subject: 'Hello',
      text: 'Hi there',
      html: '<p>Hi</p>',
    });
  });

  it('reports a provider failure', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    send.mockResolvedValue({ data: null, error: { message: 'Domain not verified' } });
    await expect(sendEmail(message)).rejects.toThrow('Email delivery failed: Domain not verified');
  });

  it('refuses to print a message in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RESEND_API_KEY', '');
    vi.resetModules();
    const production = await import('./email');
    await expect(production.sendEmail(message)).rejects.toThrow('Email delivery is not configured');
  });
});
