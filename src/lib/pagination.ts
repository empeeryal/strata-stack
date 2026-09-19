/** Page arithmetic for server-rendered lists (`?page=`). */
export interface PageInfo {
  /** Requested page, clamped to `1..pages`. */
  page: number;
  /** Number of pages; at least 1 so an empty list still renders page 1. */
  pages: number;
  /** Rows to skip. */
  offset: number;
  /** 1-based index of the first row shown (0 when the list is empty). */
  from: number;
  /** 1-based index of the last row shown. */
  to: number;
  total: number;
  pageSize: number;
}

/** Clamps a raw `?page=` value against the total, so a stale link never shows an empty page. */
export function paginate(total: number, requestedPage: unknown, pageSize: number): PageInfo {
  const size = Math.max(1, Math.floor(pageSize));
  const count = Math.max(0, Math.floor(total));
  const pages = Math.max(1, Math.ceil(count / size));
  const parsed = Math.floor(Number(requestedPage));
  const page = Math.min(pages, Math.max(1, Number.isFinite(parsed) ? parsed : 1));
  const offset = (page - 1) * size;
  return {
    page,
    pages,
    offset,
    from: count === 0 ? 0 : offset + 1,
    to: Math.min(count, offset + size),
    total: count,
    pageSize: size,
  };
}

/**
 * Escapes the SQL `LIKE` wildcards in user input so it is matched literally. Use together
 * with `ESCAPE '\'` in the query.
 */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Builds the query string for a list page, dropping empty values. */
export function listQuery(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}
