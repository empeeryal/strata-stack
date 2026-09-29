import type { CollectionEntry } from 'astro:content';
import { describe, expect, it } from 'vitest';

import { adjacentDocs, buildDocsTree, docsLocaleOf, docsSectionOf, flattenDocsTree } from './docs';

function entry(id: string, order = 100, extra: Partial<CollectionEntry<'docs'>['data']> = {}) {
  return {
    id,
    collection: 'docs',
    data: {
      title: id.split('/').pop()!.replace(/-/g, ' '),
      description: `About ${id}`,
      sidebar: { order },
      draft: false,
      ...extra,
    },
  } as unknown as CollectionEntry<'docs'>;
}

describe('docs tree', () => {
  const entries = [
    entry('guides/styling', 2),
    entry('getting-started/installation', 2),
    entry('getting-started/introduction', 1),
    entry('deploy/vercel', 1),
    entry('guides/auth', 1, { draft: true }),
    entry('extras/misc'),
  ];

  it('derives the section from the folder', () => {
    expect(docsSectionOf(entries[0]!)).toBe('guides');
    expect(docsSectionOf(entry('loose'))).toBe('reference');
  });

  it('orders sections and items, skipping drafts and empty sections', () => {
    const tree = buildDocsTree(entries);
    expect(tree.map((section) => section.id)).toEqual([
      'getting-started',
      'guides',
      'deploy',
      'extras',
    ]);
    expect(tree[0]!.items.map((item) => item.id)).toEqual([
      'getting-started/introduction',
      'getting-started/installation',
    ]);
    expect(tree[1]!.items.map((item) => item.id)).toEqual(['guides/styling']);
    expect(tree[3]!.label).toBe('Extras');
  });

  it('computes previous and next pages across sections', () => {
    const flat = flattenDocsTree(buildDocsTree(entries));
    expect(adjacentDocs(flat, 'getting-started/installation')).toMatchObject({
      prev: { id: 'getting-started/introduction' },
      next: { id: 'guides/styling' },
    });
    expect(adjacentDocs(flat, 'getting-started/introduction').prev).toBeUndefined();
    expect(adjacentDocs(flat, 'extras/misc').next).toBeUndefined();
  });
});

describe('docs locales', () => {
  it('keeps translated folders out of the default tree and builds their own', () => {
    const entries = [entry('guides/styling', 1), entry('de/guides/styling', 1)];
    expect(
      buildDocsTree(entries).flatMap((section) => section.items.map((item) => item.href)),
    ).toEqual(['/docs/guides/styling']);
    expect(
      buildDocsTree(entries, 'de').flatMap((section) => section.items.map((item) => item.href)),
    ).toEqual(['/de/docs/guides/styling']);
    expect(docsLocaleOf({ id: 'de/guides/styling' })).toBe('de');
    expect(docsSectionOf({ id: 'de/guides/styling' })).toBe('guides');
  });
});
