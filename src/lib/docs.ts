import type { CollectionEntry } from 'astro:content';

import { type Locale, defaultLocale, localizePath, splitLocaleId } from '@/i18n';

/** Sidebar sections in display order. The id is the folder name under src/content/docs. */
export const DOCS_SECTIONS = [
  { id: 'getting-started', label: 'Getting started' },
  { id: 'guides', label: 'Guides' },
  { id: 'components', label: 'Components' },
  { id: 'deploy', label: 'Deploy' },
  { id: 'reference', label: 'Reference' },
] as const;

export interface DocsNavItem {
  id: string;
  href: string;
  label: string;
  title: string;
  description: string;
  badge?: 'new' | 'updated' | 'experimental';
}

export interface DocsSection {
  id: string;
  label: string;
  items: DocsNavItem[];
}

/**
 * Locale of a docs entry from its folder: `<locale>/guides/styling` translates `guides/styling`.
 * Entries without a locale folder belong to the default locale.
 */
export function docsLocaleOf(entry: Pick<CollectionEntry<'docs'>, 'id'>): Locale {
  return splitLocaleId(entry.id).locale;
}

export function docsSectionOf(entry: Pick<CollectionEntry<'docs'>, 'id'>): string {
  const { slug } = splitLocaleId(entry.id);
  return slug.includes('/') ? slug.split('/')[0]! : 'reference';
}

/**
 * Group the published docs of `locale` by section, ordered by DOCS_SECTIONS then
 * `sidebar.order`. Entries of other locales are left out, so a translated folder never leaks
 * into the English sidebar.
 */
export function buildDocsTree(
  entries: CollectionEntry<'docs'>[],
  locale: Locale = defaultLocale,
): DocsSection[] {
  const published = entries.filter((entry) => !entry.data.draft && docsLocaleOf(entry) === locale);
  const order = new Map(published.map((entry) => [entry.id, entry.data.sidebar.order]));

  const sections: DocsSection[] = DOCS_SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
    items: [],
  }));

  for (const entry of published) {
    const sectionId = docsSectionOf(entry);
    let section = sections.find((candidate) => candidate.id === sectionId);
    if (!section) {
      section = { id: sectionId, label: titleCase(sectionId), items: [] };
      sections.push(section);
    }
    const item: DocsNavItem = {
      id: entry.id,
      href: localizePath(`/docs/${splitLocaleId(entry.id).slug}`, locale),
      label: entry.data.sidebar.label ?? entry.data.title,
      title: entry.data.title,
      description: entry.data.description,
    };
    if (entry.data.sidebar.badge) item.badge = entry.data.sidebar.badge;
    section.items.push(item);
  }

  for (const section of sections) {
    section.items.sort(
      (a, b) => order.get(a.id)! - order.get(b.id)! || a.label.localeCompare(b.label),
    );
  }

  return sections.filter((section) => section.items.length > 0);
}

/** Flat, sidebar-ordered list used for previous/next navigation. */
export function flattenDocsTree(tree: DocsSection[]): DocsNavItem[] {
  return tree.flatMap((section) => section.items);
}

export function adjacentDocs(flat: DocsNavItem[], id: string) {
  const index = flat.findIndex((item) => item.id === id);
  return {
    prev: index > 0 ? flat[index - 1] : undefined,
    next: index >= 0 && index < flat.length - 1 ? flat[index + 1] : undefined,
  };
}

function titleCase(value: string): string {
  return value.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
