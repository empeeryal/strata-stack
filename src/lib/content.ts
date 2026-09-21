import { type CollectionEntry, getCollection } from 'astro:content';
import readingTime from 'reading-time';

export type BlogPost = CollectionEntry<'blog'>;

/**
 * Whether a post belongs in a production build: not a draft and not dated in the future. A
 * static site only re-evaluates this at build time, so a future date needs a rebuild on or
 * after that day to publish.
 */
export function isPublished(data: { draft: boolean; pubDate: Date }, now = new Date()): boolean {
  return !data.draft && data.pubDate.valueOf() <= now.valueOf();
}

/** Published blog posts, newest first. Development shows drafts and future posts as well. */
export async function getPublishedPosts(): Promise<BlogPost[]> {
  const posts = await getCollection('blog', ({ data }) =>
    import.meta.env.PROD ? isPublished(data) : true,
  );
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/** Estimated reading time such as "4 min read". */
export function getReadingTime(body: string | undefined): string {
  const minutes = Math.max(1, Math.round(readingTime(body ?? '').minutes));
  return `${minutes} min read`;
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

export function postHref(post: BlogPost): string {
  return `/blog/${post.id}`;
}

export function tagHref(tag: string): string {
  return `/blog/tags/${encodeURIComponent(tag)}`;
}

/** Generated Open Graph image for a blog post (see src/pages/og/[...slug].png.ts). */
export function postOgImage(post: BlogPost): string {
  return `/og/blog/${post.id}.png`;
}

export function docsOgImage(id: string): string {
  return `/og/docs/${id}.png`;
}
