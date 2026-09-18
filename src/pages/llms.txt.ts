import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

import { getPublishedPosts, postHref } from '@/lib/content';
import { buildDocsTree } from '@/lib/docs';
import { siteConfig } from '@/site.config';

/**
 * https://llmstxt.org – a concise, LLM-friendly map of the site.
 * See /llms-full.txt for the complete documentation text.
 */
export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL(siteConfig.url);
  const url = (path: string) => new URL(path, base).toString();
  const tree = buildDocsTree(await getCollection('docs'));
  const posts = await getPublishedPosts();

  const lines: string[] = [
    `# ${siteConfig.name}`,
    '',
    `> ${siteConfig.tagline}`,
    '',
    siteConfig.description,
    '',
    `The full documentation as a single file is available at ${url('/llms-full.txt')}.`,
    '',
  ];

  for (const section of tree) {
    lines.push(`## Docs: ${section.label}`, '');
    for (const item of section.items) {
      lines.push(`- [${item.title}](${url(item.href)}): ${item.description}`);
    }
    lines.push('');
  }

  lines.push('## Blog', '');
  for (const post of posts) {
    lines.push(`- [${post.data.title}](${url(postHref(post))}): ${post.data.description}`);
  }
  lines.push('', '## Optional', '');
  lines.push(`- [Changelog](${url('/changelog')}): Release notes for every version.`);
  lines.push(`- [About](${url('/about')}): Why the template exists and how this site is built.`);
  lines.push(`- [Source code](${siteConfig.repo.url}): GitHub repository (MIT).`, '');

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
