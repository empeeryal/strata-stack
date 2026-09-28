// Kept free of imports: the header's account menu script loads it on every page.

/**
 * Up to two initials for an avatar fallback: the first letters of the first and last words of
 * the name ("Ada Lovelace" → "AL", "Ada" → "A"), or "?" when there is no name at all.
 */
export function initials(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  const letters = `${first}${last}`.toUpperCase();
  return letters || '?';
}
