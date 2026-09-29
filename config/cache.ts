import type { AstroUserConfig } from 'astro';

import type { DeployTarget } from './adapter';

export type CacheProviderConfig = NonNullable<NonNullable<AstroUserConfig['cache']>['provider']>;

/**
 * The response cache behind `Astro.cache` and `routeRules`, chosen per deploy target.
 *
 * On Vercel, Netlify and Cloudflare the provider only writes the platform's cache headers
 * (`Vercel-CDN-Cache-Control`, `Netlify-CDN-Cache-Control`, `Cloudflare-CDN-Cache-Control` and
 * the matching cache tags); the edge does the caching and the origin is not involved again
 * until the entry expires. Node has no CDN, so cached GET responses are kept in the server
 * process instead: every instance has its own copy, and responses that set cookies are never
 * stored. See docs/guides/caching.
 */
export async function resolveCacheProvider(target: DeployTarget): Promise<CacheProviderConfig> {
  switch (target) {
    case 'vercel': {
      const { cacheVercel } = await import('@astrojs/vercel/cache');
      return cacheVercel();
    }
    case 'netlify': {
      const { cacheNetlify } = await import('@astrojs/netlify/cache');
      return cacheNetlify();
    }
    case 'cloudflare': {
      const { cacheCloudflare } = await import('@astrojs/cloudflare/cache');
      return cacheCloudflare();
    }
    case 'node': {
      const { memoryCache } = await import('astro/config');
      // Enough for every public route of a site this size; entries are evicted least recently used.
      return memoryCache({ max: 500 });
    }
  }
}
