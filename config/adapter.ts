import type { AstroIntegration } from 'astro';

export const DEPLOY_TARGETS = ['node', 'vercel', 'cloudflare', 'netlify'] as const;
export type DeployTarget = (typeof DEPLOY_TARGETS)[number];

export function isDeployTarget(value: string): value is DeployTarget {
  return (DEPLOY_TARGETS as readonly string[]).includes(value);
}

/**
 * Decide which platform we are building for.
 *
 * Priority:
 * 1. Explicit `DEPLOY_TARGET` (recommended in CI and in the platform dashboard)
 * 2. Platform-provided variables: Vercel sets `VERCEL=1`, Netlify sets
 *    `NETLIFY=true`, Cloudflare Workers Builds sets `WORKERS_CI=1`
 * 3. Fallback to the Node standalone server (also used for Docker and local e2e)
 */
export function resolveDeployTarget(env: NodeJS.ProcessEnv = process.env): DeployTarget {
  const explicit = env.DEPLOY_TARGET?.trim().toLowerCase();
  if (explicit) {
    if (isDeployTarget(explicit)) return explicit;
    throw new Error(
      `Unknown DEPLOY_TARGET "${explicit}". Expected one of: ${DEPLOY_TARGETS.join(', ')}.`,
    );
  }
  if (env.VERCEL) return 'vercel';
  if (env.NETLIFY) return 'netlify';
  if (env.WORKERS_CI || env.CF_PAGES) return 'cloudflare';
  return 'node';
}

/**
 * Lazily import only the adapter we need so that config load time stays fast and
 * the other adapters' dependencies are never evaluated.
 */
export async function resolveAdapter(target: DeployTarget): Promise<AstroIntegration> {
  switch (target) {
    case 'vercel': {
      const { default: vercel } = await import('@astrojs/vercel');
      return vercel({
        // Serve images through Vercel Image Optimization at runtime.
        imageService: true,
        // Emit CSP headers for prerendered pages instead of <meta> tags.
        staticHeaders: true,
      });
    }
    case 'cloudflare': {
      const { default: cloudflare } = await import('@astrojs/cloudflare');
      return cloudflare({
        // Build-time endpoints (OG images, RSS, sitemap) may use Node-only
        // packages such as sharp/resvg; on-demand routes still run in workerd.
        prerenderEnvironment: 'node',
      });
    }
    case 'netlify': {
      const { default: netlify } = await import('@astrojs/netlify');
      return netlify({ staticHeaders: true });
    }
    case 'node': {
      const { default: node } = await import('@astrojs/node');
      return node({ mode: 'standalone', staticHeaders: true });
    }
  }
}
