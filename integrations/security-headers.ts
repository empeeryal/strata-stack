import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { AstroIntegration } from 'astro';

import type { DeployTarget } from '../config/adapter';
import { securityHeaders as headers } from '../config/security-headers';

export interface SecurityHeadersOptions {
  target: DeployTarget;
}

/**
 * Applies the shared security headers to prerendered pages on platforms that need
 * build-time configuration.
 *
 * - **Vercel**: prepends a header route to `.vercel/output/config.json` (Build Output
 *   API). The adapter writes that file in its own `build:done` hook, which runs first
 *   because adapters are always the first integration.
 * - **Netlify / Cloudflare**: read `_headers` from the publish directory, which is
 *   copied from `public/_headers` automatically; nothing to do here.
 * - **Node**: the standalone server has no static header config; on-demand routes get
 *   headers from `src/middleware.ts`, static files should be fronted by a reverse proxy.
 *
 * The Content-Security-Policy header is handled separately by Astro (`security.csp`).
 */
export function securityHeaders({ target }: SecurityHeadersOptions): AstroIntegration {
  let root: URL | undefined;

  return {
    name: 'framework:security-headers',
    hooks: {
      'astro:config:done': ({ config }) => {
        root = config.root;
      },
      'astro:build:done': async ({ logger }) => {
        if (target !== 'vercel' || !root) return;

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
      },
    },
  };
}
