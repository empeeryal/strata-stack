import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { Loader } from 'astro/loaders';
import { z } from 'astro/zod';

export interface ChangelogLoaderOptions {
  /** Path to the Changesets-maintained changelog, relative to the project root. */
  file?: string;
}

/**
 * Splits `CHANGELOG.md` into one entry per release (each `## <version>` heading) so
 * the changelog page can link to individual versions and the RSS feed can list them.
 * The Markdown body of every release is rendered with Astro's Markdown pipeline.
 */
export function changelogLoader({ file = 'CHANGELOG.md' }: ChangelogLoaderOptions = {}): Loader {
  return {
    name: 'changelog-loader',
    schema: z.object({
      version: z.string(),
      /** 0 for the newest release, increasing for older ones. */
      order: z.number().int().nonnegative(),
      /** Optional ISO date taken from a trailing `(YYYY-MM-DD)` on the heading. */
      date: z.coerce.date().optional(),
    }),
    async load({ store, renderMarkdown, watcher, logger, config }) {
      const url = new URL(file, config.root);
      const filePath = fileURLToPath(url);

      const parse = async () => {
        let raw: string;
        try {
          raw = await readFile(url, 'utf8');
        } catch {
          logger.warn(`No changelog found at ${file}; the changelog collection is empty.`);
          store.clear();
          return;
        }

        store.clear();
        const sections = raw.split(/^## (?=\S)/m).slice(1);
        for (const [order, section] of sections.entries()) {
          const newline = section.indexOf('\n');
          const heading = (newline === -1 ? section : section.slice(0, newline)).trim();
          const body = (newline === -1 ? '' : section.slice(newline + 1)).trim();
          const dateMatch = heading.match(/\((\d{4}-\d{2}-\d{2})\)\s*$/);
          const version = heading.replace(/\s*\(\d{4}-\d{2}-\d{2}\)\s*$/, '').trim();
          const id = version.replace(/[^a-zA-Z0-9.-]+/g, '-');

          store.set({
            id,
            data: { version, order, ...(dateMatch ? { date: dateMatch[1] } : {}) },
            body,
            filePath: file,
            rendered: await renderMarkdown(body),
          });
        }
        logger.info(
          `Loaded ${sections.length} changelog release${sections.length === 1 ? '' : 's'}`,
        );
      };

      await parse();

      watcher?.add(filePath);
      watcher?.on('change', (changed) => {
        if (changed === filePath) void parse();
      });
    },
  };
}
