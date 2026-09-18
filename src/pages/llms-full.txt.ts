import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

import { buildDocsTree } from '@/lib/docs';
import { siteConfig } from '@/site.config';

/** Every documentation page concatenated as Markdown, for LLM consumption. */
export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL(siteConfig.url);
  const docs = await getCollection('docs', ({ data }) => !data.draft);
  const tree = buildDocsTree(docs);

  const chunks: string[] = [
    `# ${siteConfig.name} documentation`,
    '',
    `> ${siteConfig.tagline}`,
    '',
  ];

  for (const section of tree) {
    for (const item of section.items) {
      const entry = docs.find((doc) => doc.id === item.id);
      if (!entry) continue;
      chunks.push(
        `---`,
        '',
        `# ${entry.data.title}`,
        '',
        `> ${entry.data.description}`,
        '',
        `Section: ${section.label}`,
        `URL: ${new URL(item.href, base).toString()}`,
        '',
        (entry.body ?? '').trim(),
        '',
      );
    }
  }

  return new Response(chunks.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
