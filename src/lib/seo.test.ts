import { describe, expect, it } from 'vitest';

import { siteConfig } from '@/site.config';

import {
  blogPostingJsonLd,
  breadcrumbsJsonLd,
  pageTitle,
  serializeJsonLd,
  websiteJsonLd,
} from './seo';

const site = 'https://example.com';

describe('pageTitle', () => {
  it('appends the site name', () => {
    expect(pageTitle('Docs')).toBe(`Docs · ${siteConfig.name}`);
  });

  it('uses the tagline on the home page', () => {
    expect(pageTitle()).toBe(`${siteConfig.name} – ${siteConfig.tagline}`);
  });
});

describe('json-ld', () => {
  it('escapes closing tags when serialising', () => {
    const data = websiteJsonLd(site);
    const json = serializeJsonLd({ ...data, name: '</script><b>' });
    expect(json).not.toContain('</script>');
    expect(json).toContain('\\u003c/script>');
  });

  it('builds breadcrumb positions and absolute urls', () => {
    const data = breadcrumbsJsonLd([{ name: 'Docs', url: '/docs' }, { name: 'Intro' }], site);
    expect(data.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Docs', item: 'https://example.com/docs' },
      { '@type': 'ListItem', position: 2, name: 'Intro' },
    ]);
  });

  it('describes a blog posting', () => {
    const data = blogPostingJsonLd({
      url: '/blog/hello',
      title: 'Hello',
      description: 'World',
      image: '/og/blog/hello.png',
      datePublished: new Date('2026-09-18T00:00:00Z'),
      author: { name: 'Ada', url: 'https://ada.example' },
      tags: ['a', 'b'],
      site,
    });
    expect(data['@type']).toBe('BlogPosting');
    expect(data.headline).toBe('Hello');
    expect(data.image).toBe('https://example.com/og/blog/hello.png');
    expect(data.dateModified).toBe('2026-09-18T00:00:00.000Z');
    expect(data.keywords).toBe('a, b');
    expect(data.author).toMatchObject({ '@type': 'Person', name: 'Ada' });
  });
});
