import { describe, expect, it } from 'vitest';

import { resolvedVersions } from './stack';

const LOCKFILE = `lockfileVersion: '9.0'

importers:

  .:
    dependencies:
      '@libsql/client':
        specifier: ^0.18.0
        version: 0.18.0
      astro:
        specifier: ^7.3.3
        version: 7.3.3(@types/node@24.13.5)(typescript@6.0.3)
    devDependencies:
      vitest:
        specifier: ^5.0.1
        version: 5.0.1(happy-dom@20.14.5)

packages:

  astro@7.3.3:
    resolution: {integrity: sha512-xyz}
`;

describe('resolvedVersions', () => {
  it('returns the installed version without peer suffixes', () => {
    expect(resolvedVersions(LOCKFILE, ['astro', '@libsql/client', 'vitest'])).toEqual({
      astro: '7.3.3',
      '@libsql/client': '0.18.0',
      vitest: '5.0.1',
    });
  });

  it('omits packages that are not in the root importer', () => {
    expect(resolvedVersions(LOCKFILE, ['react'])).toEqual({});
  });
});
