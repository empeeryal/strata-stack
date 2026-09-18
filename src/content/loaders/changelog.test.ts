import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { changelogLoader } from './changelog';

const sample = `# my-site

## 1.1.0 (2026-09-18)

### Minor Changes

- Added search.

## 1.0.0

### Major Changes

- Initial release.
`;

async function runLoader(contents: string) {
  const dir = await mkdtemp(path.join(tmpdir(), 'changelog-'));
  await writeFile(path.join(dir, 'CHANGELOG.md'), contents);

  const entries = new Map<string, unknown>();
  const store = {
    set: (entry: { id: string }) => entries.set(entry.id, entry),
    clear: () => entries.clear(),
  };
  const logs: string[] = [];
  const context = {
    store,
    renderMarkdown: async (md: string) => ({ html: `<p>${md}</p>` }),
    logger: { info: (m: string) => logs.push(m), warn: (m: string) => logs.push(m) },
    config: { root: pathToFileURL(`${dir}/`) },
    watcher: undefined,
  };

  await changelogLoader().load(context as never);
  return { entries: [...entries.values()] as Array<Record<string, unknown>>, logs };
}

describe('changelogLoader', () => {
  it('creates one entry per release heading', async () => {
    const { entries } = await runLoader(sample);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      id: '1.1.0',
      data: { version: '1.1.0', order: 0, date: '2026-09-18' },
    });
    expect(entries[1]).toMatchObject({ id: '1.0.0', data: { version: '1.0.0', order: 1 } });
    expect((entries[1]!.data as { date?: string }).date).toBeUndefined();
    expect(entries[0]!.body).toContain('Added search.');
    expect((entries[0]!.rendered as { html: string }).html).toContain('<p>');
  });

  it('handles a missing file gracefully', async () => {
    const { entries, logs } = await runLoader('');
    expect(entries).toHaveLength(0);
    expect(logs.join(' ')).toContain('Loaded 0');
  });
});
