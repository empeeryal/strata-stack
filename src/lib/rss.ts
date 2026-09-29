import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getEntry } from 'astro:content';

import { type Locale, useTranslations } from '@/i18n';
import { getPublishedPosts, postHref } from '@/lib/content';
import { siteConfig } from '@/site.config';

/** The blog feed for one locale; `/rss.xml` and `/<locale>/rss.xml` call this. */
export async function buildFeed(context: APIContext, locale: Locale): Promise<Response> {
  const site = context.site ?? new URL(siteConfig.url);
  const t = useTranslations(locale);
  const posts = await getPublishedPosts(locale);

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
    title: t('blog.feedTitle'),
    description: t('blog.description'),
    site,
    items,
    trailingSlash: false,
    customData: `<language>${locale}</language>`,
  });
}
