import { describe, expect, it } from 'vitest';

import {
  absoluteUrl,
  clamp,
  cn,
  formatDate,
  slugify,
  stripTrailingSlash,
  toISODate,
} from './utils';

describe('cn', () => {
  it('merges class names and resolves Tailwind conflicts', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-sm', false, undefined, 'font-bold')).toBe('text-sm font-bold');
  });
});

describe('slugify', () => {
  it('produces url-safe slugs', () => {
    expect(slugify('Hello World!')).toBe('hello-world');
    expect(slugify('  Ünïcödé   text ')).toBe('unicode-text');
    expect(slugify('--already-slug--')).toBe('already-slug');
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

describe('urls', () => {
  it('strips trailing slashes except for the root', () => {
    expect(stripTrailingSlash('/blog/')).toBe('/blog');
    expect(stripTrailingSlash('/blog///')).toBe('/blog');
    expect(stripTrailingSlash('/')).toBe('/');
  });

  it('builds absolute urls', () => {
    expect(absoluteUrl('/docs', 'https://example.com')).toBe('https://example.com/docs');
  });
});

describe('clamp', () => {
  it('keeps values inside bounds', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});
