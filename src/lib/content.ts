import { type CollectionEntry, getCollection } from 'astro:content';
import readingTime from 'reading-time';

import { type Locale, defaultLocale, localizePath, splitLocaleId } from '@/i18n';

export type BlogPost = CollectionEntry<'blog'>;

/**
 * Whether a post belongs in a production build: not a draft and not dated in the future. A
 * static site only re-evaluates this at build time, so a future date needs a rebuild on or
 * after that day to publish.
 */
export function isPublished(data: { draft: boolean; pubDate: Date }, now = new Date()): boolean {
  return !data.draft && data.pubDate.valueOf() <= now.valueOf();
}

/**
 * Locale of a post from its folder: `src/content/blog/<locale>/<slug>.mdx` translates
 * `src/content/blog/<slug>.mdx`. Posts at the top level belong to the default locale.
 */
export function postLocale(post: Pick<BlogPost, 'id'>): Locale {
  return splitLocaleId(post.id).locale;
}

/** The slug shared by a post and its translations. */
export function postSlug(post: Pick<BlogPost, 'id'>): string {
  return splitLocaleId(post.id).slug;
}

/** Published posts of every locale, newest first. Development shows drafts and future posts. */
export async function getAllPublishedPosts(): Promise<BlogPost[]> {
  const posts = await getCollection('blog', ({ data }) =>
    import.meta.env.PROD ? isPublished(data) : true,
  );
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/** Published posts written in `locale`, newest first. */
export async function getPublishedPosts(locale: Locale = defaultLocale): Promise<BlogPost[]> {
  return (await getAllPublishedPosts()).filter((post) => postLocale(post) === locale);
}

/** Paths of `post` in the other locales that have a translation, for `hreflang` alternates. */
export function postAlternates(
  post: Pick<BlogPost, 'id'>,
  all: Array<Pick<BlogPost, 'id'>>,
): Partial<Record<Locale, string>> {
  const slug = postSlug(post);
  const alternates: Partial<Record<Locale, string>> = {};
  for (const candidate of all) {
    if (candidate.id === post.id || postSlug(candidate) !== slug) continue;
    alternates[postLocale(candidate)] = postHref(candidate);
  }
  return alternates;
}

/** Default-locale posts that have no translation in `locale`, newest first. */
export function untranslatedPosts<T extends Pick<BlogPost, 'id'>>(locale: Locale, all: T[]): T[] {
  const translated = new Set(
    all.filter((post) => postLocale(post) === locale).map((post) => postSlug(post)),
  );
  return all.filter(
    (post) => postLocale(post) === defaultLocale && !translated.has(postSlug(post)),
  );
}

/** Estimated reading time in whole minutes, at least one. */
export function getReadingMinutes(body: string | undefined): number {
  return Math.max(1, Math.round(readingTime(body ?? '').minutes));
}

/** Unique tags with post counts, most used first. */
export function collectTags(posts: BlogPost[]): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.data.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** `/blog/<slug>` for the default locale, `/<locale>/blog/<slug>` for a translated post. */
export function postHref(post: Pick<BlogPost, 'id'>): string {
  return localizePath(`/blog/${postSlug(post)}`, postLocale(post));
}

/** Tag pages exist for the default locale only. */
export function tagHref(tag: string): string {
  return `/blog/tags/${encodeURIComponent(tag)}`;
}

/** Generated Open Graph image for a blog post (see src/pages/og/[...slug].png.ts). */
export function postOgImage(post: Pick<BlogPost, 'id'>): string {
  return `/og/blog/${post.id}.png`;
}

export function docsOgImage(id: string): string {
  return `/og/docs/${id}.png`;
}
