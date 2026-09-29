import { describe, expect, it } from 'vitest';

import { resolveCacheProvider } from './cache';

describe('resolveCacheProvider', () => {
  it.each([
    ['vercel', '@astrojs/vercel/cache/provider'],
    ['netlify', '@astrojs/netlify/cache/provider'],
    ['cloudflare', '@astrojs/cloudflare/cache/provider'],
  ] as const)(
    'uses the %s adapter provider, which writes the CDN headers',
    async (target, entrypoint) => {
      await expect(resolveCacheProvider(target)).resolves.toMatchObject({
        name: target,
        entrypoint,
      });
    },
  );

  it('keeps responses in the server process on Node', async () => {
    await expect(resolveCacheProvider('node')).resolves.toMatchObject({
      name: 'memory',
      entrypoint: 'astro/cache/memory',
      config: { max: 500 },
    });
  });
});
