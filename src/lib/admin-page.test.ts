import { describe, expect, it } from 'vitest';

import { noticeMessage, summarizeActionResults, withNotice } from './admin-page';

describe('noticeMessage', () => {
  it('renders known keys only', () => {
    expect(noticeMessage('message-archived')).toBe('Message archived.');
    expect(noticeMessage('<script>')).toBeNull();
    expect(noticeMessage('toString')).toBeNull();
    expect(noticeMessage(null)).toBeNull();
  });
});

describe('withNotice', () => {
  it('appends the key with the right separator', () => {
    expect(withNotice('/admin/messages', 'message-deleted')).toBe(
      '/admin/messages?notice=message-deleted',
    );
    expect(withNotice('/admin/messages?status=new', 'message-read')).toBe(
      '/admin/messages?status=new&notice=message-read',
    );
    expect(withNotice('/admin', null)).toBe('/admin');
  });
});

describe('summarizeActionResults', () => {
  it('reports completion, the first error and the notice of the completed action', () => {
    expect(summarizeActionResults([undefined, undefined])).toEqual({
      completed: false,
      error: null,
      notice: null,
    });
    expect(
      summarizeActionResults([
        { error: { message: 'first' } },
        { error: { message: 'second' } },
        { data: { notice: 'role-updated' } },
      ]),
    ).toEqual({ completed: true, error: 'first', notice: 'role-updated' });
    expect(summarizeActionResults([{ data: { notice: 'bogus' } }]).notice).toBeNull();
  });
});
