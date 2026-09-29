import { describe, expect, it } from 'vitest';

import {
  isPublished,
  postAlternates,
  postHref,
  postLocale,
  postOgImage,
  postSlug,
  untranslatedPosts,
} from './content';

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

describe('post locales', () => {
  // The site ships one locale; a folder that is not a configured locale is part of the slug.
  const posts = [{ id: 'why-astro-7' }, { id: 'deploy-anywhere' }];

  it('reads the locale and slug from the folder', () => {
    expect(postLocale({ id: 'why-astro-7' })).toBe('en');
    expect(postSlug({ id: 'why-astro-7' })).toBe('why-astro-7');
    expect(postLocale({ id: 'de/why-astro-7' })).toBe('en');
    expect(postSlug({ id: 'de/why-astro-7' })).toBe('de/why-astro-7');
  });

  it('builds links and images from the slug', () => {
    expect(postHref({ id: 'why-astro-7' })).toBe('/blog/why-astro-7');
    expect(postOgImage({ id: 'why-astro-7' })).toBe('/og/blog/why-astro-7.png');
  });

  it('finds no translations and nothing untranslated while there is one locale', () => {
    expect(postAlternates({ id: 'why-astro-7' }, posts)).toEqual({});
    expect(untranslatedPosts('en', posts)).toEqual([]);
  });
});
