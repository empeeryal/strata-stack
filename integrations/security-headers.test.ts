import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { AstroIntegration } from 'astro';
import { describe, expect, it, vi } from 'vitest';

import { securityHeaders as expected } from '../config/security-headers';

import { securityHeaders } from './security-headers';

type Hooks = NonNullable<AstroIntegration['hooks']>;
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

/** Runs the integration's two hooks against a scratch project directory. */
async function build(target: 'node' | 'vercel' | 'netlify', root: string, outDir: string) {
  const integration = securityHeaders({ target });
  const configDone = integration.hooks['astro:config:done'] as NonNullable<
    Hooks['astro:config:done']
  >;
  const buildDone = integration.hooks['astro:build:done'] as NonNullable<Hooks['astro:build:done']>;
  await configDone({
    config: { root: pathToFileURL(`${root}/`), outDir: pathToFileURL(`${outDir}/`) },
  } as never);
  // For a server build the hook's `dir` is the client directory, not the output root.
  await buildDone({ dir: pathToFileURL(`${outDir}/client/`), logger } as never);
}

describe('securityHeaders integration', () => {
  it('adds the shared headers to every prerendered route of the Node server', async () => {
    const root = await mkdtemp(join(tmpdir(), 'strata-headers-'));
    const dist = join(root, 'dist');
    await mkdir(dist);
    const csp = { key: 'Content-Security-Policy', value: "default-src 'self'" };
    await writeFile(
      join(dist, '_headers.json'),
      JSON.stringify([
        { pathname: '/', headers: [csp] },
        { pathname: '/about', headers: [csp, { key: 'x-frame-options', value: 'SAMEORIGIN' }] },
      ]),
    );

    await build('node', root, dist);

    const records = JSON.parse(await readFile(join(dist, '_headers.json'), 'utf8')) as Array<{
      pathname: string;
      headers: Array<{ key: string; value: string }>;
    }>;
    const home = Object.fromEntries(records[0]!.headers.map((h) => [h.key, h.value]));
    expect(home['Content-Security-Policy']).toBe("default-src 'self'");
    for (const [name, value] of Object.entries(expected)) expect(home[name]).toBe(value);
    // A header the record already carries is left alone.
    const about = records[1]!.headers.filter((h) => h.key.toLowerCase() === 'x-frame-options');
    expect(about).toEqual([{ key: 'x-frame-options', value: 'SAMEORIGIN' }]);
  });

  it('prepends a header route to the Vercel build output', async () => {
    const root = await mkdtemp(join(tmpdir(), 'strata-headers-'));
    await mkdir(join(root, '.vercel/output'), { recursive: true });
    await writeFile(
      join(root, '.vercel/output/config.json'),
      JSON.stringify({ version: 3, routes: [{ handle: 'filesystem' }] }),
    );

    await build('vercel', root, join(root, 'dist'));

    const config = JSON.parse(await readFile(join(root, '.vercel/output/config.json'), 'utf8')) as {
      routes: Array<Record<string, unknown>>;
    };
    expect(config.routes[0]).toEqual({ src: '/(.*)', headers: expected, continue: true });
    expect(config.routes[1]).toEqual({ handle: 'filesystem' });
  });

  it('warns instead of failing when the file to patch is missing, and does nothing elsewhere', async () => {
    const root = await mkdtemp(join(tmpdir(), 'strata-headers-'));
    logger.warn.mockClear();
    await build('node', root, join(root, 'dist'));
    await build('vercel', root, join(root, 'dist'));
    expect(logger.warn).toHaveBeenCalledTimes(2);
    await build('netlify', root, join(root, 'dist'));
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });
});
