import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { AstroIntegration } from 'astro';

import type { DeployTarget } from '../config/adapter';
import { securityHeaders as headers } from '../config/security-headers';

export interface SecurityHeadersOptions {
  target: DeployTarget;
}

interface StaticHeaderRecord {
  pathname: string;
  headers: Array<{ key: string; value: string }>;
}

/**
 * Applies the shared security headers to prerendered pages on platforms that need
 * build-time configuration.
 *
 * - **Vercel**: prepends a header route to `.vercel/output/config.json` (Build Output
 *   API). The adapter writes that file in its own `build:done` hook, which runs first
 *   because adapters are always the first integration.
 * - **Node**: the standalone server serves prerendered pages with the headers listed in
 *   `_headers.json`, which Astro writes for the Content-Security-Policy; the shared headers
 *   are added to every record, so static pages are hardened without a reverse proxy.
 * - **Netlify / Cloudflare**: read `_headers` from the publish directory, which is
 *   copied from `public/_headers` automatically; nothing to do here.
 *
 * On-demand routes get the same headers from `src/middleware.ts` on every target. The
 * Content-Security-Policy header itself is handled by Astro (`security.csp`).
 */
export function securityHeaders({ target }: SecurityHeadersOptions): AstroIntegration {
  let root: URL | undefined;
  let outDir: URL | undefined;

  return {
    name: 'framework:security-headers',
    hooks: {
      'astro:config:done': ({ config }) => {
        root = config.root;
        outDir = config.outDir;
      },
      'astro:build:done': async ({ logger }) => {
        if (target === 'vercel' && root) await writeVercelHeaders(root, logger);
        // The hook's `dir` is the client directory for a server build; the Node adapter reads
        // the header map from the output root next to it.
        if (target === 'node' && outDir) await writeNodeHeaders(outDir, logger);
      },
    },
  };
}

type Logger = Parameters<NonNullable<AstroIntegration['hooks']['astro:build:done']>>[0]['logger'];

async function writeVercelHeaders(root: URL, logger: Logger): Promise<void> {
  const configUrl = new URL('.vercel/output/config.json', root);
  let raw: string;
  try {
    raw = await readFile(configUrl, 'utf8');
  } catch {
    logger.warn(`Could not find ${fileURLToPath(configUrl)}; security headers not applied.`);
    return;
  }

  const config = JSON.parse(raw) as { routes?: unknown[] };
  const route = { src: '/(.*)', headers: { ...headers }, continue: true };
  config.routes = [route, ...(config.routes ?? [])];
  await writeFile(configUrl, JSON.stringify(config, null, 2));
  logger.info('Added security headers to the Vercel Build Output config.');
}

async function writeNodeHeaders(outDir: URL, logger: Logger): Promise<void> {
  const fileUrl = new URL('_headers.json', outDir);
  let raw: string;
  try {
    raw = await readFile(fileUrl, 'utf8');
  } catch {
    logger.warn(`Could not find ${fileURLToPath(fileUrl)}; security headers not applied.`);
    return;
  }

  const records = JSON.parse(raw) as StaticHeaderRecord[];
  const extra = Object.entries(headers).map(([key, value]) => ({ key, value }));
  for (const record of records) {
    const present = new Set(record.headers.map((header) => header.key.toLowerCase()));
    record.headers.push(...extra.filter((header) => !present.has(header.key.toLowerCase())));
  }
  await writeFile(fileUrl, JSON.stringify(records, null, '\t'));
  logger.info(
    `Added security headers to ${records.length} prerendered routes for the Node server.`,
  );
}
