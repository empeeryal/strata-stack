/**
 * Reads the exact versions pnpm installed from `pnpm-lock.yaml`, so the homepage can show
 * what the site really runs on instead of the declared ranges in package.json.
 * Build-time only (the homepage is prerendered in Node on every target).
 */

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Resolved version of each requested package for the root importer, when present. */
export function resolvedVersions(
  lockfile: string,
  packages: readonly string[],
): Record<string, string> {
  // Root importer block: `importers:` (optionally followed by blank lines), then `  .:` and its
  // indented entries, up to the next top-level key or the next importer.
  const importer =
    lockfile.match(/^importers:\n(?:[ \t]*\n)* {2}\.:\n([\s\S]*?)(?=^\S|^ {2}\S)/m)?.[1] ?? '';
  const versions: Record<string, string> = {};
  for (const name of packages) {
    const match = importer.match(
      new RegExp(
        `^ {6}'?${escapeRegExp(name)}'?:\\n {8}specifier: [^\\n]*\\n {8}version: ([^\\s(]+)`,
        'm',
      ),
    );
    if (match?.[1]) versions[name] = match[1];
  }
  return versions;
}
