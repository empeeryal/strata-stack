import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

import { changelogLoader } from './content/loaders/changelog';

/** Blog posts written in MDX under src/content/blog. */
const blog = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().max(90),
      description: z.string().max(200),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      author: reference('authors'),
      tags: z.array(z.string()).default([]),
      /** Optional local hero image, e.g. `./images/hero.png`. Falls back to the generated OG image. */
      heroImage: image().optional(),
      heroAlt: z.string().optional(),
      draft: z.boolean().default(false),
    }),
});

/** Authors referenced by blog posts. */
const authors = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/authors' }),
  schema: z.object({
    name: z.string(),
    title: z.string().optional(),
    bio: z.string().optional(),
    /** Absolute URL of an avatar image (e.g. https://github.com/<user>.png). */
    avatar: z.url().optional(),
    url: z.url().optional(),
    github: z.string().optional(),
  }),
});

/** Documentation pages; the folder name is the sidebar section. */
const docs = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    sidebar: z
      .object({
        /** Position inside the section. Lower numbers first. */
        order: z.number().default(100),
        /** Shorter label for the sidebar. Defaults to the title. */
        label: z.string().optional(),
        badge: z.enum(['new', 'updated', 'experimental']).optional(),
      })
      .default({ order: 100 }),
    /** First publication, used for structured data. */
    publishedDate: z.coerce.date().optional(),
    /** Last substantive revision; set it when you change a page. */
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean().default(false),
  }),
});

/** Legal documents (privacy policy, terms). */
const legal = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/legal' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    updatedDate: z.coerce.date(),
  }),
});

/** Releases parsed from the root CHANGELOG.md (maintained by Changesets). */
const changelog = defineCollection({
  loader: changelogLoader(),
});

export const collections = { blog, authors, docs, legal, changelog };
