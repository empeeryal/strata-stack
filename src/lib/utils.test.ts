import { describe, expect, it } from 'vitest';

import { cn, formatDate, stripTrailingSlash, toISODate } from './utils';

describe('cn', () => {
  it('merges class names through tailwind-merge', () => {
    expect(cn('p-2', false, 'p-4')).toBe('p-4');
  });
});

describe('dates', () => {
  it('formats dates with a medium style by default', () => {
    expect(formatDate(new Date(Date.UTC(2026, 8, 18)))).toBe('Sep 18, 2026');
  });

  it('produces ISO strings', () => {
    expect(toISODate('2026-09-18T10:00:00.000Z')).toBe('2026-09-18T10:00:00.000Z');
  });
});

describe('stripTrailingSlash', () => {
  it('strips trailing slashes except for the root', () => {
    expect(stripTrailingSlash('/blog/')).toBe('/blog');
    expect(stripTrailingSlash('/blog///')).toBe('/blog');
    expect(stripTrailingSlash('/')).toBe('/');
  });
});
