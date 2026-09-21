import { describe, expect, it } from 'vitest';

import { isPublished } from './content';

describe('isPublished', () => {
  const now = new Date('2026-09-21T12:00:00Z');

  it('publishes posts dated now or earlier', () => {
    expect(isPublished({ draft: false, pubDate: new Date('2026-09-21T12:00:00Z') }, now)).toBe(
      true,
    );
    expect(isPublished({ draft: false, pubDate: new Date('2026-01-01') }, now)).toBe(true);
  });

  it('holds back drafts and future dates', () => {
    expect(isPublished({ draft: true, pubDate: new Date('2026-01-01') }, now)).toBe(false);
    expect(isPublished({ draft: false, pubDate: new Date('2026-09-22') }, now)).toBe(false);
  });
});
