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
  const posts = [{ id: 'why-astro-7' }, { id: 'de/why-astro-7' }, { id: 'deploy-anywhere' }];

  it('reads the locale and slug from the folder', () => {
    expect(postLocale({ id: 'de/why-astro-7' })).toBe('de');
    expect(postSlug({ id: 'de/why-astro-7' })).toBe('why-astro-7');
    expect(postLocale({ id: 'why-astro-7' })).toBe('en');
  });

  it('builds localized links and images', () => {
    expect(postHref({ id: 'why-astro-7' })).toBe('/blog/why-astro-7');
    expect(postHref({ id: 'de/why-astro-7' })).toBe('/de/blog/why-astro-7');
    expect(postOgImage({ id: 'de/why-astro-7' })).toBe('/og/blog/de/why-astro-7.png');
  });

  it('finds translations by slug', () => {
    expect(postAlternates({ id: 'why-astro-7' }, posts)).toEqual({ de: '/de/blog/why-astro-7' });
    expect(postAlternates({ id: 'de/why-astro-7' }, posts)).toEqual({ en: '/blog/why-astro-7' });
    expect(postAlternates({ id: 'deploy-anywhere' }, posts)).toEqual({});
  });

  it('lists the English posts a locale still lacks', () => {
    expect(untranslatedPosts('de', posts).map((post) => post.id)).toEqual(['deploy-anywhere']);
    expect(untranslatedPosts('en', posts)).toEqual([]);
  });
});
