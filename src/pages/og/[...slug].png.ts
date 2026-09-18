import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import satori from 'satori';

import interBold from '@/assets/fonts/inter-latin-700-normal.woff?inline';
import interRegular from '@/assets/fonts/inter-latin-400-normal.woff?inline';
import { getPublishedPosts } from '@/lib/content';
import { DOCS_SECTIONS, docsSectionOf } from '@/lib/docs';
import { type OgTemplateProps, OgTemplate } from '@/lib/og-template';
import { formatDate } from '@/lib/utils';
import { siteConfig } from '@/site.config';

/**
 * Open Graph images, prerendered at build time as PNG files:
 *   /og/default.png, /og/blog.png, /og/docs.png, /og/changelog.png,
 *   /og/blog/<post-id>.png and /og/docs/<doc-id>.png
 *
 * Rendering uses Satori (JSX → SVG) and resvg (SVG → PNG). resvg is a native module,
 * which is why this route is prerendered only and never runs on the edge.
 */
export const prerender = true;

type Props = Omit<OgTemplateProps, 'siteName' | 'host'>;

export const getStaticPaths = (async () => {
  const posts = await getPublishedPosts();
  const docs = await getCollection('docs', ({ data }) => !data.draft);

  const statics: Array<{ slug: string; props: Props }> = [
    {
      slug: 'default',
      props: {
        title: siteConfig.tagline,
        description: siteConfig.description,
        kind: siteConfig.shortName,
      },
    },
    {
      slug: 'blog',
      props: {
        title: siteConfig.blog.title,
        description: siteConfig.blog.description,
        kind: 'Blog',
      },
    },
    {
      slug: 'docs',
      props: {
        title: 'Documentation',
        description: 'Guides and reference for every part of the template.',
        kind: 'Docs',
      },
    },
    {
      slug: 'changelog',
      props: {
        title: 'Changelog',
        description: 'Every release of the template, generated from CHANGELOG.md.',
        kind: 'Releases',
      },
    },
  ];

  return [
    ...statics.map(({ slug, props }) => ({ params: { slug }, props })),
    ...posts.map((post) => ({
      params: { slug: `blog/${post.id}` },
      props: {
        title: post.data.title,
        description: post.data.description,
        kind: 'Blog',
        meta: formatDate(post.data.pubDate),
      } satisfies Props,
    })),
    ...docs.map((doc) => ({
      params: { slug: `docs/${doc.id}` },
      props: {
        title: doc.data.title,
        description: doc.data.description,
        kind: 'Docs',
        meta: DOCS_SECTIONS.find((section) => section.id === docsSectionOf(doc))?.label,
      } satisfies Props,
    })),
  ];
}) satisfies GetStaticPaths;

function decodeDataUrl(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export const GET: APIRoute<Props> = async ({ props, site }) => {
  const host = (site ?? new URL(siteConfig.url)).host;
  const svg = await satori(OgTemplate({ ...props, siteName: siteConfig.name, host }), {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Inter', data: decodeDataUrl(interRegular), weight: 400, style: 'normal' },
      { name: 'Inter', data: decodeDataUrl(interBold), weight: 700, style: 'normal' },
    ],
  });

  const { Resvg } = await import('@resvg/resvg-js');
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
