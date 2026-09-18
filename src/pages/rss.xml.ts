import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getEntry } from 'astro:content';

import { getPublishedPosts, postHref } from '@/lib/content';
import { siteConfig } from '@/site.config';

export async function GET(context: APIContext) {
  const site = context.site ?? new URL(siteConfig.url);
  const posts = await getPublishedPosts();

  const items = await Promise.all(
    posts.map(async (post) => {
      const author = await getEntry(post.data.author);
      return {
        title: post.data.title,
        description: post.data.description,
        pubDate: post.data.pubDate,
        link: postHref(post),
        categories: [...post.data.tags],
        ...(author ? { author: author.data.name } : {}),
      };
    }),
  );

  return rss({
    title: `${siteConfig.name} blog`,
    description: siteConfig.blog.description,
    site,
    items,
    trailingSlash: false,
    customData: `<language>${siteConfig.locale}</language>`,
  });
}
