/**
 * FNV-1a, base 36. Not cryptographic: it gives components ids that are stable across builds
 * (derived from their content) so prerendered HTML does not change on every deploy.
 */
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}
