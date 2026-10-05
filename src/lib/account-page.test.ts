import { describe, expect, it } from 'vitest';

import { accountNoticeMessage } from './account-page';

describe('accountNoticeMessage', () => {
  it('returns the text of a known notice', () => {
    expect(accountNoticeMessage('passkey-added')).toMatch(/passkey/i);
    expect(accountNoticeMessage('email-updated')).toMatch(/address/i);
  });

  it('returns null for anything else, so the query string cannot inject text', () => {
    expect(accountNoticeMessage('<script>')).toBeNull();
    expect(accountNoticeMessage('')).toBeNull();
    expect(accountNoticeMessage(null)).toBeNull();
    expect(accountNoticeMessage(undefined)).toBeNull();
  });
});
